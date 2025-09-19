# Angular Electron Interview App

A modern desktop application built with Angular and Electron for interview preparation and management.

## Features

- **Angular Frontend**: Modern, responsive UI built with Angular
- **Electron Desktop**: Cross-platform desktop application
- **TypeScript Support**: Full TypeScript integration for both frontend and main process
- **Build System**: Integrated build system for both Angular and Electron

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/angular-electron-interview-app.git
cd angular-electron-interview-app
```

2. Install dependencies:
```bash
npm install
```

## Development

### Run Angular development server:
```bash
npm start
```

### Build and run Electron app:
```bash
npm run electron:serve
```

### Build for production:
```bash
npm run build
```

## Project Structure

```
src/
├── app/                    # Angular application
│   ├── app.component.*    # Main component
│   └── app.module.ts      # App module
├── main/                  # Electron main process
│   └── electron-main.ts   # Main Electron file
├── assets/                # Static assets
└── index.html            # Angular entry point
```

## Build Configuration

- **Angular**: Configured via `angular.json`
- **Electron**: TypeScript configuration in `tsconfig.electron.json`
- **Build Process**: Integrated build that compiles both Angular and Electron

## Development Notes

This project includes fixes for common Angular-Electron integration issues:
- Proper TypeScript configuration for Electron main process
- Zone.js import path resolution
- Component standalone configuration

## License

MIT License