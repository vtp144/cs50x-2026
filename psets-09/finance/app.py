import os

from cs50 import SQL
from flask import Flask, flash, redirect, render_template, request, session
from flask_session import Session
from werkzeug.security import check_password_hash, generate_password_hash

from helpers import apology, login_required, lookup, usd

# Configure application
app = Flask(__name__)

# Custom filter
app.jinja_env.filters["usd"] = usd

# Configure session to use filesystem (instead of signed cookies)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

# Configure CS50 Library to use SQLite database
db = SQL("sqlite:///finance.db")


@app.after_request
def after_request(response):
    """Ensure responses aren't cached"""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"] = 0
    response.headers["Pragma"] = "no-cache"
    return response


@app.route("/")
@login_required
def index():
    # 1️⃣ Get user's cash
    user = db.execute("SELECT cash FROM users WHERE id = ?", session["user_id"])
    cash = user[0]["cash"]

    # 2️⃣ Get user's portfolio
    portfolio = db.execute("""
        SELECT symbol, SUM(shares) AS shares
        FROM transactions
        WHERE user_id = ?
        GROUP BY symbol
        HAVING shares > 0
    """, session["user_id"])

    # 3️⃣ Update each stock with lookup info
    grand_total = 0
    for stock in portfolio:
        quote = lookup(stock["symbol"])
        if quote is None:
            # fallback if lookup fails
            stock["name"] = stock["symbol"]
            stock["price"] = 0
        else:
            stock["name"] = quote["name"]
            stock["price"] = quote["price"]

        stock["total"] = stock["price"] * stock["shares"]
        grand_total += stock["total"]

    # 4️⃣ Include cash in grand total
    grand_total += cash

    # 5️⃣ Render template
    return render_template(
        "index.html",
        portfolio=portfolio,  # matches template
        cash=cash,
        grand_total=grand_total
    )


@app.route("/buy", methods=["GET", "POST"])
@login_required
def buy():
    if request.method == "POST":
        symbol = request.form.get("symbol")
        shares = request.form.get("shares")

        if not symbol:
            return apology("missing symbol")

        quote = lookup(symbol)
        if not quote:
            return apology("invalid symbol")

        try:
            shares = int(shares)
            if shares <= 0:
                raise ValueError
        except ValueError:
            return apology("shares must be a positive integer")

        price = quote["price"]
        cost = shares * price
        user_id = session["user_id"]

        cash = db.execute(
            "SELECT cash FROM users WHERE id = ?", user_id
        )[0]["cash"]

        if cost > cash:
            return apology("can't afford")

        db.execute(
            "UPDATE users SET cash = cash - ? WHERE id = ?",
            cost, user_id
        )

        db.execute("""
            INSERT INTO transactions (user_id, symbol, shares, price)
            VALUES (?, ?, ?, ?)
        """, user_id, quote["symbol"], shares, price)

        return redirect("/")

    return render_template("buy.html")


@app.route("/history")
@login_required
def history():
    # Get all transactions for the user
    transactions = db.execute("""
        SELECT symbol, shares, price, timestamp
        FROM transactions
        WHERE user_id = ?
        ORDER BY timestamp DESC
    """, session["user_id"])

    return render_template("history.html", transactions=transactions)


@app.route("/login", methods=["GET", "POST"])
def login():
    """Log user in"""

    # Forget any user_id
    session.clear()

    # User reached route via POST (as by submitting a form via POST)
    if request.method == "POST":
        # Ensure username was submitted
        if not request.form.get("username"):
            return apology("must provide username", 403)

        # Ensure password was submitted
        elif not request.form.get("password"):
            return apology("must provide password", 403)

        # Query database for username
        rows = db.execute(
            "SELECT * FROM users WHERE username = ?", request.form.get("username")
        )

        # Ensure username exists and password is correct
        if len(rows) != 1 or not check_password_hash(
            rows[0]["hash"], request.form.get("password")
        ):
            return apology("invalid username and/or password", 403)

        # Remember which user has logged in
        session["user_id"] = rows[0]["id"]

        # Redirect user to home page
        return redirect("/")

    # User reached route via GET (as by clicking a link or via redirect)
    else:
        return render_template("login.html")


@app.route("/logout")
def logout():
    """Log user out"""

    # Forget any user_id
    session.clear()

    # Redirect user to login form
    return redirect("/")


@app.route("/quote", methods=["GET", "POST"])
@login_required
def quote():
    if request.method == "GET":
        return render_template("quote.html")

    else:
        # POST: user submitted a symbol
        symbol = request.form.get("symbol")
        if not symbol:
            return apology("must provide symbol", 400)

        quote = lookup(symbol.upper())
        if quote is None:
            return apology("invalid symbol", 400)

        # Pass quote data to template
        return render_template(
            "quoted.html",
            stock=quote  # must match template variable name
        )


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        confirmation = request.form.get("confirmation")

        if not username:
            return apology("missing username")
        if not password or not confirmation:
            return apology("missing password")
        if password != confirmation:
            return apology("passwords do not match")

        try:
            db.execute(
                "INSERT INTO users (username, hash) VALUES (?, ?)",
                username,
                generate_password_hash(password)
            )
        except ValueError:
            return apology("username already exists")

        return redirect("/login")

    return render_template("register.html")


@app.route("/sell", methods=["GET", "POST"])
@login_required
def sell():
    if request.method == "GET":
        # Get all symbols the user owns
        symbols = db.execute("""
            SELECT symbol
            FROM transactions
            WHERE user_id = ?
            GROUP BY symbol
            HAVING SUM(shares) > 0
        """, session["user_id"])

        # Pass symbols to template
        return render_template("sell.html", symbols=symbols)

    else:
        # POST: user submitted a sell
        symbol = request.form.get("symbol")
        shares_to_sell = int(request.form.get("shares"))

        if not symbol:
            return apology("must provide symbol", 400)
        if shares_to_sell <= 0:
            return apology("must provide positive number of shares", 400)

        # Check how many shares user owns
        user_shares = db.execute("""
            SELECT SUM(shares) AS shares
            FROM transactions
            WHERE user_id = ? AND symbol = ?
        """, session["user_id"], symbol)

        if user_shares[0]["shares"] < shares_to_sell:
            return apology("not enough shares to sell", 400)

        # Lookup current price
        quote = lookup(symbol)
        if quote is None:
            return apology("invalid symbol", 400)

        # 1️⃣ Record the sale (negative shares)
        db.execute("""
            INSERT INTO transactions (user_id, symbol, shares, price)
            VALUES (?, ?, ?, ?)
        """, session["user_id"], symbol, -shares_to_sell, quote["price"])

        # 2️⃣ Add cash to user
        cash_earned = shares_to_sell * quote["price"]
        db.execute("""
            UPDATE users
            SET cash = cash + ?
            WHERE id = ?
        """, cash_earned, session["user_id"])

        flash(f"Sold {shares_to_sell} shares of {symbol} for ${cash_earned:,.2f}")
        return redirect("/")


@app.route("/add_cash", methods=["POST"])
@login_required
def add_cash():
    amount = request.form.get("amount")

    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError
    except ValueError:
        return apology("invalid amount")

    db.execute(
        "UPDATE users SET cash = cash + ? WHERE id = ?",
        amount, session["user_id"]
    )

    return redirect("/")
