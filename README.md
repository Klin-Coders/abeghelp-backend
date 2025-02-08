# AbegHelp.me Backend

[![StartEase](https://img.shields.io/badge/Generated%20by-StartEase-blue)](https://github.com/JC-Coder/startease)

## Overview

Welcome to the **AbegHelp.me Backend** project! This is a **Node.js** and **ExpressJS** backend application designed to power the fundraising platform **AbegHelp.me**. The project is built with **TypeScript** and includes features like campaign management, user authentication, email notifications, and more.

## Features

- **Campaign Management**:
  - Create, update, and manage fundraising campaigns in multiple steps.
  - Campaigns can be reviewed, approved, or rejected based on content relevance.
- **Authentication & Security**:
  - JWT-based authentication.
  - Two-Factor Authentication (2FA) via email or app.
  - Secure cookie handling with HTTP-only and SameSite policies.
- **Email Notifications**:
  - Welcome emails, 2FA codes, password resets, and other notifications.
  - Uses **Resend** for email delivery.
- **Queue System**:
  - Background tasks like email sending and campaign processing are handled by **BullMQ**.
- **Security Measures**:
  - Rate limiting, CORS, CSP (Content Security Policy), and other security best practices.
- **Environment Configuration**:
  - Uses `.env` files for environment-specific configurations.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (>=20.11.0) and **npm** or **yarn**.
- **MongoDB** (for database).
- **Redis** (for caching and queue management).

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/abeg-help/backend.git
   cd backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

   or

   ```bash
   yarn install
   ```

3. Set up environment variables:
   - Create a `.env` file in the project root.
   - Add the following variables:
     ```plaintext
     APP_NAME=AbegHelp
     APP_PORT=3000
     NODE_ENV=development
     MONGO_URI=your-mongodb-uri
     REDIS_URL=your-redis-url
     EMAIL_API_KEY=your-resend-api-key
     JWT_ACCESS_KEY=your-jwt-access-key
     ```

## Running the Project

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Build the project for production:

   ```bash
   npm run build
   ```

3. Start the production server:
   ```bash
   npm start
   ```

## Project Structure

- **`src/`**: Contains the source code.
  - **`controllers/`**: Handles request logic.
  - **`models/`**: Defines MongoDB schemas.
  - **`queues/`**: Manages background tasks using BullMQ.
  - **`routes/`**: Defines API routes.
  - **`scripts/`**: Contains utility scripts like seeders.
  - **`common/`**: Shared utilities, constants, and interfaces.
- **`build/`**: Contains the compiled TypeScript code (generated after build).

## Contributing

We welcome contributions! Please follow our [Contribution Guidelines](CONTRIBUTING.md) to get started.

## License

This project is proprietary and confidential. Unauthorized copying, transferring, or reproduction of the contents of this project is strictly prohibited.

## Support

For any issues or questions, please open an issue in the [GitHub repository](https://github.com/abeg-help/backend/issues).

---

**Happy Coding!** 🚀
