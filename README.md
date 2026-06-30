# ArenaHub – BGMI Esports Tournament Management System

A full-stack role-based esports tournament management platform that enables organizers to create and manage BGMI tournaments while allowing players to discover, register, and participate through a secure OTP-based authentication system.

## Live Demo

Frontend:
https://bgmi-tournament-management-system-m.vercel.app

Backend:
https://bgmi-tournament-management-system.onrender.com

---

## Features

### Authentication
- Email OTP verification using Brevo API
- JWT-based authentication
- Secure password hashing using bcrypt
- Role-based signup and login
- Organizer, Player and Admin roles

### Organizer
- Create tournaments and scrims
- Configure game mode, maps and match timings
- Set prize pool and maximum team slots
- View tournament applicants
- Approve or reject registrations

### Player
- Browse available tournaments
- View tournament details
- Register for tournaments
- Track application status

### Admin
- Manage users
- Monitor tournaments
- Role-based access control

---

## Tech Stack

### Frontend
- React
- Vite
- React Router
- Axios

### Backend
- Node.js
- Express.js

### Database
- SQLite

### Authentication
- JWT
- bcrypt

### Email Service
- Brevo Transactional Email API

### Deployment
- Vercel
- Render

---

## Project Structure

```text
MINI PROJECT
│
├── frontend
├── backend
├── README.md
```

---

## Installation

### Clone Repository

```bash
git clone <repository-url>
```

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Future Improvements

- Tournament banner uploads
- Tournament lifecycle management
- Match history
- Tournament analytics
- Notifications
- Enhanced organizer dashboard

---

## Author

Aswin D
