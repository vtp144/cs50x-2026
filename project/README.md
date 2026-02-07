# NHỚ HOÀI

A full-stack vocabulary learning app inspired by Memrise community courses.

- Create courses (decks) with source/target languages
- Add vocabulary (term / meaning / note)
- Study with multiple-choice quizzes + “I don’t know”
- Session summary (correct/wrong per word)
- SRS-ish difficulty (wrong → harder, correct → easier) persisted in DB
- Auth with username/password (JWT)

---

## Tech Stack

**Backend**

- Django + Django REST Framework
- SimpleJWT (access/refresh)
- SQLite (dev)

**Frontend**

- React + Vite
- React Router
- TanStack React Query
- Axios

---

## Core Features

### Authentication

- Register (username/password)
- Login (JWT)
- Current user endpoint (`/api/auth/me/`)
- Protected API routes (must be authenticated)

### Courses (Decks)

- List all courses (Home)
- Create course
- Edit course
- Delete course
- Each course stores:
  - title
  - source_lang, target_lang
  - cards_count

### Vocabulary (Cards)

- Add words to a course:
  - `term` (word)
  - `meaning` (definition)
  - `note` (extra hint/memo)
- Inline edit word (click edit → update → OK)
- Delete word

### Study / Quiz

- Multiple choice (4 answers)
- “I don’t know” option
- Shows result (correct/wrong), meaning + note
- Session policy:
  - Build a **core set** (default 6 words)
  - Continue until session ends by policy (including re-queue wrong answers)
- Session summary:
  - shows each word with correct/wrong counts
  - “Study next session” carries hard words to next session

---

## Local Setup (Development)

### Requirements

- Python 3.9+ (use `python3`)
- Node.js 18+ recommended
- npm

---

## Backend (Django)

### 1) Create & activate virtualenv (recommended)

From repo root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

### 2) Install dependencies

```bash
pip install -U pip
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers
```

### 3) Run migrations

```bash
python3 manage.py migrate
```

### 4) Run backend server

```bash
python3 manage.py runserver
```

## Frontend (React + Vite)

### 1) Install dependencies

```bash
cd ../frontend

npm install
```

### 2) Run frontend dev server

```bash
npm run dev
```
