# DCORE Control Center

DCORE is a unified distribution, inventory, and POS checkout management platform.

## Project Structure
*   `backend/`: Spring Boot Java API backend handling products, inventory, transactions, customers, deliveries, and reports.
*   `frontend/`: React + TypeScript + Vite user interface styled with custom CSS and served via Nginx.
*   `docker-compose.yml`: Main container orchestration file.

## Prerequisites
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## How to Run

1.  Open your terminal in the project root directory.
2.  Launch the container stack using Docker Compose:
    ```bash
    docker compose up --build
    ```
3.  Access the React application in your browser at:
    [http://localhost:3000](http://localhost:3000)

## Demo Login Credentials

*   **Administrator**:
    *   Username: `admin`
    *   Password: `admin123`
    *   *Permissions: Full access to POS, Inventory, Deliveries, Operating Expenses, and Reports/Dashboard.*

*   **Sales Representative**:
    *   Username: `sales`
    *   Password: `sales123`
    *   *Permissions: POS Checkout, Inventory view, Deliveries, and Operating Expenses. Dashboard/Profit reports are hidden.*
