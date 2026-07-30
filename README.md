# School Management System

A modern, multi-tenant school management system with barcode-based attendance tracking.

## Features

- **Multi-tenant Architecture**: Each school has its own isolated data
- **Authentication**: Secure login/signup with JWT
- **Student Management**: Add, edit, delete students with unique barcodes
- **Staff Management**: Manage staff and non-staff members
- **Attendance System**: Mark attendance using barcode scanner
- **Message System**: Internal messaging between parents/teachers and admin
- **Dashboard**: Real-time statistics and charts
- **Responsive Design**: Works on desktop, tablet, and mobile

## Tech Stack

### Backend
- Node.js + Express
- PostgreSQL with Supabase
- JWT Authentication
- bcrypt for password hashing

### Frontend
- React with Vite
- TailwindCSS for styling
- Recharts for data visualization
- React Router for navigation
- Axios for API calls

## Installation

### Prerequisites
- Node.js (v14 or higher)
- Supabase account (free tier works)

### Setup Instructions

1. **Clone the repository**
```bash
git clone <repository-url>
cd school-management-system