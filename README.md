# 💰 Money Tracker & Expense Tracker

A complete offline-first Android app for tracking money lent to borrowers and personal expenses.

## 📱 Features

### Module 1: Money Tracker 💰
- ✅ Borrower CRUD (Create, Read, Update, Delete)
- ✅ Track money given/received
- ✅ Dashboard with totals (Given, Received, Outstanding)
- ✅ Per-borrower balance tracking
- ✅ Transaction history

### Module 2: Expense Tracker 💸
- ✅ Expense CRUD by category
- ✅ Category CRUD with color coding
- ✅ Dashboard with day/week/month filter
- ✅ Visual category breakdown with progress bars
- ✅ Recent expenses view

### Dashboard Features
- ✅ **Toggle between modules** (Money ↔ Expense)
- ✅ Consolidated view in "More" tab
- ✅ Per-borrower detail view
- ✅ Period filters (Day/Week/Month/All Time)

## 🚀 Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development
```bash
npx expo start
```

### 3. Scan QR code with Expo Go app

## 📲 Build Standalone APK

```bash
# Login to Expo (first time only)
npx eas login

# Build APK
npx eas build --platform android --profile preview
```

Build takes 15-30 minutes. You'll get an email with download link.

## 🛠️ Tech Stack

- **Framework:** React Native + Expo
- **Navigation:** Expo Router
- **Database:** Expo SQLite (local storage)
- **Auth:** Expo SecureStore
- **Language:** TypeScript

## 📂 Project Structure

```
tracker-app/
├── app/                    # Screens (file-based routing)
│   ├── (tabs)/            # Bottom tab navigation
│   │   ├── dashboard.tsx  # Module toggle dashboard
│   │   ├── money.tsx      # Money tracker
│   │   ├── expenses.tsx   # Expense tracker
│   │   └── more.tsx       # Consolidated view
│   ├── login.tsx
│   └── signup.tsx
├── src/
│   ├── components/        # Reusable UI components
│   ├── context/          # Auth context
│   └── lib/              # Database & auth logic
└── app.json
```

## 💾 Data Storage

All data stored **locally on phone** using SQLite:
- Users
- Borrowers
- Money transactions
- Expense categories
- Expenses

## 🎯 Usage

1. **Sign up** for an account
2. **Money Tab:** Add borrowers, then record money given/received
3. **Expense Tab:** Add expenses by category
4. **Dashboard:** Toggle between Money and Expense views
5. **More Tab:** See consolidated view and per-borrower details
