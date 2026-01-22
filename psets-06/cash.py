from cs50 import get_float

# Prompt user until a non-negative value is provided
while True:
    dollars = get_float("Change owed: ")
    if dollars >= 0:
        break

# Convert dollars to cents (avoid floating-point imprecision)
cents = round(dollars * 100)

coins = 0

# Calculate minimum number of coins
for value in [25, 10, 5, 1]:
    coins += cents // value
    cents %= value

# Output result
print(coins)
