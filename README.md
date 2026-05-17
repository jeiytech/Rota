# Rota — Staff Scheduling & Payroll App

A lightweight Flask web application for managing employee shift rotas, calculating payroll, and sending automated email notifications.

---

## Features

- **Weekly rota view** — drag-and-drop style shift scheduling across a calendar grid
- **Employee management** — add, edit, and delete staff with roles, colours, and hourly pay rates
- **Payroll export** — download an `.xlsx` spreadsheet with a payroll summary and full shift detail breakdown
- **Email notifications** — automatically notify employees when a shift is created, updated, or cancelled (requires SMTP configuration)
- **SQLite database** — zero-config local storage, auto-initialised on first run
- **Break rules** — automatically deducts unpaid break time (trailing ≤30 min stripped; additional 1 hour deducted for shifts ≥8 hours)

---

## Project Structure

```
Rota/
├── __init__.py        # App factory, config, blueprint registration
├── db.py              # SQLite connection helpers and CLI init command
├── schema.sql         # Table definitions and seed data
├── admin.py           # Admin blueprint (employee management UI)
├── user.py            # Main blueprint (rota view, all REST API endpoints)
├── static/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── main.js
└── templates/
    ├── admin/
    │   └── employee-add.html
    └── user/
        ├── index.html
        └── rota.html
```

---

## Requirements

- Python 3.9+
- pip

---

## Installation & Running

### 1. Clone the repository

```bash
git clone https://github.com/your-username/rota.git
cd rota
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the app

```bash
flask --app Rota run --debug
```

The app will be available at [http://localhost:5000](http://localhost:5000).

> The database is created automatically on first run — no manual setup needed.

---

## Configuration

By default the app uses development settings defined in `Rota/__init__.py`. You can override any value by creating an `instance/config.py` file (this is gitignored):

```python
# instance/config.py
SECRET_KEY = "your-secure-random-key"

# Optional — SMTP email notifications
MAIL_SERVER   = "smtp.gmail.com"
MAIL_PORT     = 587
MAIL_USERNAME = "your@email.com"
MAIL_PASSWORD = "your-app-password"
```

### Environment variables (alternative to config.py)

| Variable | Default | Description |
|---|---|---|
| `MAIL_SERVER` | `smtp.gmail.com` | SMTP server hostname |
| `MAIL_PORT` | `587` | SMTP port |
| `MAIL_USERNAME` | _(empty)_ | SMTP login — email skipped if not set |
| `MAIL_PASSWORD` | _(empty)_ | SMTP password or app password |

Email notifications are silently skipped if `MAIL_USERNAME` or `MAIL_PASSWORD` are not configured.

---

## API Endpoints

### Employees

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/employees` | List all employees |
| `POST` | `/api/employees` | Create an employee |
| `PUT` | `/api/employees/<id>` | Update an employee |
| `DELETE` | `/api/employees/<id>` | Delete an employee |

### Shifts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/shifts?start=YYYY-MM-DD&end=YYYY-MM-DD` | List shifts (optionally filtered by date range) |
| `POST` | `/api/shifts` | Create a shift |
| `PUT` | `/api/shifts/<id>` | Update a shift |
| `DELETE` | `/api/shifts/<id>` | Delete a shift |
| `GET` | `/api/shifts/export?start=YYYY-MM-DD&end=YYYY-MM-DD` | Download payroll `.xlsx` |

---

## Resetting the Database

To wipe and re-initialise the database (this deletes all data):

```bash
flask --app Rota init-db
```

---

## License

MIT
