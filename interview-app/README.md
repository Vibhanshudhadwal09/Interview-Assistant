# Angular Electron App

This project is a desktop application built using Angular and Electron. It serves as a template for creating cross-platform desktop applications with web technologies.

## Project Structure

- `src/app/app.component.ts`: Defines the root component of the Angular application.
- `src/app/app.module.ts`: Main module of the Angular application, imports necessary modules and declares components.
- `src/app/app.component.html`: HTML template for the AppComponent.
- `src/main/electron-main.ts`: Entry point for the Electron application, manages the application window and lifecycle.
- `angular.json`: Configuration file for Angular CLI.
- `package.json`: Configuration file for npm, lists dependencies and scripts.
- `tsconfig.json`: TypeScript configuration file.

## Setup Instructions

1. Install Node.js if you haven't already.
2. Open a terminal and navigate to the project directory.
3. Run `npm install` to install the necessary dependencies.
4. Run `ng build` to build the Angular application.
5. Run `npm run electron` to start the Electron application.

## Scripts

Make sure to add the following scripts in your `package.json` for building and running Electron:

```json
"scripts": {
  "ng": "ng",
  "start": "ng serve",
  "build": "ng build",
  "electron": "electron ."
}
```

## Usage

After running the application, you should see the main window of your Angular Electron app. You can modify the components and styles as needed to customize your application.