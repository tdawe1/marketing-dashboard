# Marketing Dashboard

This is a full-stack marketing dashboard application built with Encore, React, and TypeScript. It allows users to connect to various marketing platforms, upload data, and view unified metrics and analysis.

## Tech Stack

- **Backend:** [Encore](https://encore.dev/) (TypeScript)
- **Frontend:** [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **UI:** [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **Data Visualization:** [Recharts](https://recharts.org/)
- **State Management:** [TanStack Query](https://tanstack.com/query/latest)

For a detailed explanation of the tech stack choices, see [TECH_STACK_EXPLANATION.md](TECH_STACK_EXPLANATION.md).

## Features

- **Unified Dashboard:** View key metrics from multiple sources in one place.
- **Data Integrations:** Connect to Google Ads, Facebook Ads, and Google Analytics.
- **File Upload:** Upload marketing data from CSV files.
- **Data Analysis:** Get insights and recommendations based on your data.
- **Job Scheduling:** Schedule regular data imports and analysis.
- **Exporting:** Export data and analysis to CSV.
- **Demo Mode:** Explore the dashboard with sample data.

## Getting Started

### Prerequisites

- [Encore CLI](https://encore.dev/docs/install)
- [Bun](https://bun.sh/)

### Installation and Running

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd marketing-dashboard
    ```

2.  **Install dependencies:**
    ```bash
    bun install
    ```

3.  **Run the backend:**
    Navigate to the `backend` directory and start the Encore development server:
    ```bash
    cd backend
    encore run
    ```

4.  **Run the frontend:**
    In a new terminal, navigate to the `frontend` directory and start the development server:
    ```bash
    cd frontend
    bun dev
    ```

The frontend will be available at `http://localhost:5173` and the backend at the URL provided by Encore (usually `http://localhost:4000`).

For more detailed development and deployment instructions, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Project Structure

The project is organized into two main directories:

-   `backend/`: The Encore application containing all backend services for dashboard data, integrations, and scheduling.
-   `frontend/`: The React application for the user interface.

This monorepo setup is managed by [Bun workspaces](https://bun.sh/docs/install/workspaces).

## Live Demo

[Link to live demo (if available)]
