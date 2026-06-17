# BGMI Esports Tournament Management System

Role-based BGMI tournament platform with OTP signup and separate Organizer/Player pages.

## Stack
- Frontend: React + Vite + React Router
- Backend: Node.js + Express
- Database: SQLite
- Auth: JWT + bcrypt
- Email OTP: Nodemailer (Gmail App Password or Ethereal fallback)

## Features
- Email OTP signup flow: email -> OTP verify -> password set
- Role selection at signup: `organizer` / `player`
- Organizer pages:
  - Create tournament/scrim with:
    - game mode buttons: squad/duo/solo + TPP/FPP
    - total matches
    - match timings
    - map rotation
    - optional prize pool
    - max team registrations
    - minimum required ID level
  - View all applicants per tournament
  - Approve/reject applications
- Player pages:
  - View tournament/scrim list
  - Slot availability check
  - Apply flow asks team name, IGL contact, UID, IGN, ID level
  - Auto blocks apply if slots full
- 2026 roadmap section styled after official KRAFTON Esports layout

## Run
### Backend
```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

### Frontend
```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

## Gmail OTP Setup
1. Enable 2-step verification on your Google account
2. Create App Password for Mail
3. Put values in `backend/.env`:
   - `EMAIL_USER=yourgmail@gmail.com`
   - `EMAIL_PASS=your_app_password`

