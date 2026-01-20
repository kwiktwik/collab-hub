# CollabHub

A collaborative project management tool inspired by Jira, Notion, and ClickUp. Features group-based access control, document management, secure credential storage, and file management.

## Features

- **Multi-Project Management**: Create and manage multiple projects
- **Group-Based Access Control**: Create groups, invite members, and share projects with different permission levels
- **Documentation**: Create and organize documents within projects
- **Secure Credentials**: Store API keys, passwords, and other sensitive data with encryption
- **File Storage**: Upload and manage files with S3-compatible storage
- **User Authentication**: Simple username-password based authentication

## Tech Stack

### Frontend
- React 18 with TypeScript
- Webpack for bundling
- React Router for navigation
- Axios for API calls
- Lucide React for icons

### Backend
- Express.js with TypeScript
- SQLite with Drizzle ORM
- S3-compatible storage (local storage faker for development)
- bcrypt for password hashing
- AES-256 encryption for credentials

## Project Structure

```
collab-hub/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # React contexts (Auth)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── styles/         # CSS styles
│   │   ├── types/          # TypeScript types
│   │   ├── App.tsx         # Main app component
│   │   └── index.tsx       # Entry point
│   ├── public/             # Static assets
│   ├── webpack.config.js   # Webpack configuration
│   └── package.json
├── server/                  # Express backend
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── db/             # Database schema & migrations
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic & storage
│   │   ├── utils/          # Utility functions
│   │   └── index.ts        # Server entry point
│   ├── drizzle.config.ts   # Drizzle ORM config
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   cd zed-base
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize the database**
   ```bash
   npm run db:migrate
   ```

5. **Start the server**
   ```bash
   npm run dev
   ```

6. **Install client dependencies** (in a new terminal)
   ```bash
   cd client
   npm install
   ```

7. **Start the client**
   ```bash
   npm run dev
   ```

8. **Open your browser**
   Navigate to http://localhost:3000

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update current user
- `PUT /api/auth/me/password` - Change password

### Users
- `GET /api/users/search?q=query` - Search users
- `GET /api/users/:userId` - Get user by ID

### Groups
- `GET /api/groups` - List user's groups
- `POST /api/groups` - Create group
- `GET /api/groups/:groupId` - Get group details
- `PUT /api/groups/:groupId` - Update group
- `DELETE /api/groups/:groupId` - Delete group
- `POST /api/groups/:groupId/members` - Add member
- `PUT /api/groups/:groupId/members/:userId` - Update member role
- `DELETE /api/groups/:groupId/members/:userId` - Remove member

### Projects
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project
- `GET /api/projects/:projectId` - Get project details
- `PUT /api/projects/:projectId` - Update project
- `DELETE /api/projects/:projectId` - Delete project
- `POST /api/projects/:projectId/groups` - Share with group
- `PUT /api/projects/:projectId/groups/:groupId` - Update permission
- `DELETE /api/projects/:projectId/groups/:groupId` - Remove group access

### Documents
- `GET /api/documents/project/:projectId` - List project documents
- `POST /api/documents` - Create document
- `GET /api/documents/:documentId` - Get document
- `PUT /api/documents/:documentId` - Update document
- `DELETE /api/documents/:documentId` - Delete document

### Credentials
- `GET /api/credentials/project/:projectId` - List project credentials
- `POST /api/credentials` - Create credential
- `GET /api/credentials/:credentialId/value` - Get decrypted value
- `PUT /api/credentials/:credentialId` - Update credential
- `DELETE /api/credentials/:credentialId` - Delete credential

### Files
- `GET /api/files/project/:projectId` - List project files
- `POST /api/files/upload` - Upload file
- `GET /api/files/:fileId/download` - Download file
- `GET /api/files/:fileId/url` - Get download URL
- `PUT /api/files/:fileId` - Update file
- `DELETE /api/files/:fileId` - Delete file
- `POST /api/files/folders` - Create folder
- `PUT /api/files/folders/:folderId` - Update folder
- `DELETE /api/files/folders/:folderId` - Delete folder

## Database Schema

### Users
- id, username, email, password_hash, display_name, avatar_url, created_at, updated_at

### Groups
- id, name, description, created_by, created_at, updated_at

### Group Members
- id, group_id, user_id, role (admin|member), created_at

### Projects
- id, name, description, status (active|archived|completed), created_by, created_at, updated_at

### Project Groups
- id, project_id, group_id, permission_level (read|write|admin), created_at

### Documents
- id, project_id, title, content, parent_id, sort_order, created_by, created_at, updated_at

### Credentials
- id, project_id, name, type, encrypted_value, encryption_iv, description, created_by, created_at, updated_at

### Files
- id, project_id, name, original_name, storage_key, mime_type, size, folder_id, created_by, created_at

### Folders
- id, project_id, name, parent_id, created_by, created_at

## Storage Configuration

### Local Storage (Development)
By default, files are stored in the `uploads` directory. This is suitable for development and testing.

### S3 Storage (Production)
Set `STORAGE_TYPE=s3` in your environment and configure:
- `S3_ENDPOINT` - S3 endpoint URL
- `S3_REGION` - AWS region
- `S3_ACCESS_KEY_ID` - Access key
- `S3_SECRET_ACCESS_KEY` - Secret key
- `S3_BUCKET` - Bucket name
- `S3_FORCE_PATH_STYLE` - Use path-style URLs (for MinIO)

## Security

- Passwords are hashed using bcrypt with 12 rounds
- Credentials are encrypted using AES-256-GCM
- Session-based authentication with HTTP-only cookies
- Group-based access control for all resources

## Development

### Running in Development Mode

```bash
# Terminal 1 - Server
cd server
npm run dev

# Terminal 2 - Client
cd client
npm run dev
```

### Building for Production

```bash
# Build client
cd client
npm run build

# Build server
cd server
npm run build

# Start production server
npm start
```

## License

MIT