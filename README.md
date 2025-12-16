# eTuitionBd - Tuition Management System (Server)

The server-side application for the eTuitionBd platform, which manages all core business logic, database interactions, and secure operations for the Tuition Management System.

## 🔗 Live API Endpoint

The backend API is deployed and accessible at:
[eTuitionBd Server API](https://e-tuition-bd-server-gamma.vercel.app/)

## 🚀 Project Overview

The backend acts as the central hub for the platform, facilitating the interaction between the database and the client application. It handles user authentication, authorization, data management for tuitions and applications, and secure payment processing.

**Key Responsibilities:**

- **API Management:** Serving RESTful endpoints for the front-end.
- **Database Operations:** Managing user, tuition, application, and financial data in MongoDB.
- **Authentication & Authorization:** Securely verifying user identity and role using Firebase Admin SDK and managing access with JWT.
- **Payment Processing:** Handling server-side logic for Stripe payments and webhooks.
- **Tuition Moderation:** Implementing the approval/rejection workflow for tuition posts.

## 🛠️ Technologies Used

The server is built with Node.js and the following key dependencies:

| Category           | Technology/Package         | Role                                                                                                                |
| :----------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **Core Framework** | `express` (v5.2.1)         | Fast, unopinionated, minimalist web framework for building the API.                                                 |
| **Database**       | `mongodb` (v7.0.0)         | Official driver for interacting with the MongoDB NoSQL database.                                                    |
| **Authentication** | `firebase-admin` (v13.6.0) | Server-side verification of Firebase ID tokens and custom JWT claims for role-based access control.                 |
| **Payments**       | `stripe` (v20.0.0)         | Handling payment intents, processing transactions, and managing server-side payment logic.                          |
| **Utilities**      | `dotenv` (v17.2.3)         | Loading environment variables from a `.env` file for secure configuration (e.g., MongoDB credentials, Stripe keys). |
| **Security**       | `cors` (v2.8.5)            | Handling Cross-Origin Resource Sharing to allow the client application to securely communicate with the API.        |

## ⚙️ Setup & Installation

To run the eTuitionBd server locally, follow these steps:

### Prerequisites

- Node.js (LTS version recommended)
- MongoDB database instance (local or cloud-hosted).
- Stripe Developer Account.
- Firebase Project with Admin SDK configuration.

### Steps

1.  **Clone the repository:**

    ```bash
    git clone [Your-GitHub-Server-Repository-Link-Here]
    cd eTuitionBD-server
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a file named `.env` in the root directory. This file must contain all sensitive credentials, including:
    **_(Note: MongoDB credentials and Firebase keys must be secured using .env.)_**

    ```
    # Example .env file content
    PORT=5000
    MONGODB_URI=mongodb+srv://user:password@clustername/dbname?retryWrites=true&w=majority
    JWT_SECRET=YOUR_JWT_SECRET_KEY
    STRIPE_SECRET_KEY=sk_test_...
    # Your Firebase Admin SDK JSON content should be loaded here or referenced,
    # depending on your setup method for firebase-admin
    FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
    ```

4.  **Start the server:**
    ```bash
    npm start
    # or
    node index.js
    ```
    The server will start, typically on port `5000` or the port specified in your `.env` file.

## 🔑 Core API Endpoints (High-Level)

The backend exposes a secure set of endpoints to support the platform's features:

- `/api/v1/auth/`: Endpoints for user registration, login, and token generation.
- `/api/v1/users/`: Endpoints for fetching, updating, and deleting user profiles (Admin Management).
- `/api/v1/tuitions/`: Endpoints for creating, fetching (all, single), updating, and deleting tuition posts.
- `/api/v1/applications/`: Endpoints for tutors to apply, and students/admins to manage application status (approve/reject).
- `/api/v1/admin/tuition-management/`: Endpoints for admin-specific functions (Approving/Rejecting posts).
- `/api/v1/payments/`: Endpoints to create payment intents, process transactions, and manage payment webhooks (Stripe integration).

## ✅ Quality Assurance Checklist

The following mandatory requirements have been strictly followed:

- **Commits:** Ensured at least **12 meaningful commits** on the server-side repository.
- **Dependencies:** Used `express`, `mongodb`, and `stripe` as core packages.
- **Security:** MongoDB credentials are secured using `.env`, and Firebase/JWT are used for authentication and protected routes.
- **Deployment:** The deployment is configured to run `index.js` and should not show any CORS / 404 / 504 issues.
- **Token Verification:** Implemented JWT role verification to verify Role, Access Level, and Token Expiration for all protected routes.
