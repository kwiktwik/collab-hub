# CollabHub

A collaborative project management platform with **organization-based** access control, secure credential storage, and file management.

## Features

### Organizations
- **Multi-tenant**: Users can create multiple organizations and belong to multiple orgs
- **Role-based Access**: Organization roles (Owner, Admin, Member)
- **Invite System**: Invite users by email with secure token-based invitations
- **Self-service**: Anyone can register and create organizations

### JIRA-like Task Management
- **Kanban Boards**: Full-featured boards for task management
- **Sprints**: Plan work with time-boxed sprints (planning, active, completed)
- **Customizable Columns**: Default columns (Backlog, To Do, In Progress, Done, Deployed) plus custom
- **Multi-Group Access**: Share boards with multiple groups (groups don't see each other)
- **Task Types**: Story, Task, Bug, Epic, Subtask
- **Priorities**: Highest to Lowest with visual indicators
- **Labels**: Custom color-coded labels for categorization
- **Story Points**: Estimate work with story points
- **Comments**: Discuss tasks with team members
- **Drag & Drop**: Move tasks between columns easily
- **WIP Limits**: Set work-in-progress limits per column

### Team Collaboration
- **Groups**: Create teams within organizations with admin/member roles
- **Projects**: Create projects and share with multiple groups
- **Permission Levels**: read/write/admin per group
- **Real-time Notifications**: Task assignments, invites, updates
- **Documents**: Create and organize documents within projects
- **Secure Credentials**: Store API keys, passwords with AES-256 encryption
- **File Management**: Upload and organize files with folder support

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: SQLite with Drizzle ORM
- **Authentication**: iron-session
- **Encryption**: AES-256-CBC for credentials
- **Styling**: Glassmorphism CSS theme (no external framework)
- **TypeScript**: Full type safety

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
cd collab-hub
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and update:
- `SESSION_SECRET`: A random 32+ character string
- `ENCRYPTION_KEY`: Exactly 32 characters for AES-256

4. Initialize the database:
```bash
npm run db:push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

7. Register your first account and create your first organization!

## Organization-Based Access

CollabHub uses an **organization-based** access model (like Slack, Discord, GitHub):

### How It Works

1. **Anyone can register** - No approval needed
2. **Create organizations** - Each org is a separate workspace
3. **Creator becomes owner** - Full admin access to their org
4. **Invite members** - Owners and admins can invite people by email
5. **Multiple orgs** - Users can belong to multiple organizations

### Organization Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, can delete org, transfer ownership |
| **Admin** | Manage members, invites, groups, projects, boards |
| **Member** | Access assigned groups, projects, boards |

### Invitation Flow

1. Org admin creates invite with email and role
2. Invite link generated (valid for 7 days)
3. Invitee receives notification (if already registered) or link
4. Invitee accepts invite to join organization
6. Rejected users see a message explaining why they were not approved

## Permission Management

Admins can assign granular permissions to users:

| Permission | Description |
|------------|-------------|
| **Admin** | Full system access, can manage all users and settings |
| **Can Create Groups** | User can create new groups (otherwise can only join existing) |
| **Can Create Projects** | User can create projects in groups they admin |

## Project Structure

```
collab-hub/
├── app/
│   ├── (app)/              # Protected app routes
│   │   ├── admin/          # Admin pages (user management)
│   │   ├── boards/         # JIRA-like boards
│   │   ├── dashboard/      # Main dashboard
│   │   ├── groups/         # Groups management
│   │   ├── projects/       # Projects management
│   │   └── settings/       # User settings
│   ├── (auth)/             # Auth routes (login, register)
│   ├── api/                # API routes
│   │   ├── admin/          # Admin endpoints
│   │   ├── auth/           # Authentication endpoints
│   │   ├── boards/         # Board CRUD & tasks
│   │   ├── credentials/    # Credential management
│   │   ├── documents/      # Document CRUD
│   │   ├── files/          # File upload/download
│   │   ├── groups/         # Group CRUD
│   │   ├── notifications/  # Notification endpoints
│   │   ├── projects/       # Project CRUD
│   │   └── users/          # User management
│   ├── globals.css         # Global styles (glassmorphism theme)
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page
├── components/             # React components
├── lib/
│   ├── db/                 # Database schema and migrations
│   ├── services/           # Storage services
│   ├── auth.ts             # Auth utilities
│   ├── encryption.ts       # Credential encryption
│   ├── notifications.ts    # Notification helpers
│   ├── session.ts          # Session management
│   └── types.ts            # TypeScript types
└── scripts/                # Database scripts
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update profile
- `PUT /api/auth/me/password` - Change password

### Users
- `GET /api/users/search?q=` - Search users
- `GET /api/users/[userId]` - Get user by ID

### Groups
- `GET /api/groups` - List user's groups
- `POST /api/groups` - Create group
- `GET /api/groups/[groupId]` - Get group details
- `PUT /api/groups/[groupId]` - Update group
- `DELETE /api/groups/[groupId]` - Delete group
- `POST /api/groups/[groupId]/members` - Add member
- `PUT /api/groups/[groupId]/members/[userId]` - Update member role
- `DELETE /api/groups/[groupId]/members/[userId]` - Remove member

### Projects
- `GET /api/projects` - List accessible projects
- `POST /api/projects` - Create project
- `GET /api/projects/[projectId]` - Get project details
- `PUT /api/projects/[projectId]` - Update project
- `DELETE /api/projects/[projectId]` - Delete project
- `POST /api/projects/[projectId]/groups` - Share with group
- `PUT /api/projects/[projectId]/groups/[groupId]` - Update permission
- `DELETE /api/projects/[projectId]/groups/[groupId]` - Remove group access

### Documents
- `GET /api/documents/project/[projectId]` - List project documents
- `POST /api/documents` - Create document
- `GET /api/documents/[documentId]` - Get document
- `PUT /api/documents/[documentId]` - Update document
- `DELETE /api/documents/[documentId]` - Delete document
- `POST /api/documents/reorder` - Reorder documents

### Credentials
- `GET /api/credentials/project/[projectId]` - List project credentials
- `POST /api/credentials` - Create credential
- `PUT /api/credentials/[credentialId]` - Update credential
- `DELETE /api/credentials/[credentialId]` - Delete credential
- `GET /api/credentials/[credentialId]/value` - Get decrypted value

### Files
- `GET /api/files/project/[projectId]` - List project files
- `POST /api/files/upload` - Upload file
- `PUT /api/files/[fileId]` - Update file
- `DELETE /api/files/[fileId]` - Delete file
- `GET /api/files/[fileId]/download` - Download file
- `GET /api/files/[fileId]/url` - Get signed URL
- `POST /api/files/folders` - Create folder
- `PUT /api/files/folders/[folderId]` - Update folder
- `DELETE /api/files/folders/[folderId]` - Delete folder

### Boards (JIRA-like Task Management)
- `GET /api/boards` - List accessible boards
- `POST /api/boards` - Create board
- `GET /api/boards/[boardId]` - Get board with columns and tasks
- `PUT /api/boards/[boardId]` - Update board
- `DELETE /api/boards/[boardId]` - Delete board
- `GET /api/boards/[boardId]/columns` - List columns
- `POST /api/boards/[boardId]/columns` - Create column
- `PUT /api/boards/[boardId]/columns` - Reorder columns
- `PUT /api/boards/[boardId]/columns/[columnId]` - Update column
- `DELETE /api/boards/[boardId]/columns/[columnId]` - Delete column
- `POST /api/boards/[boardId]/groups` - Share board with group
- `PUT /api/boards/[boardId]/groups/[groupId]` - Update group permission
- `DELETE /api/boards/[boardId]/groups/[groupId]` - Remove group access
- `GET /api/boards/[boardId]/sprints` - List sprints
- `POST /api/boards/[boardId]/sprints` - Create sprint
- `GET /api/boards/[boardId]/sprints/[sprintId]` - Get sprint with tasks
- `PUT /api/boards/[boardId]/sprints/[sprintId]` - Update sprint (start, complete)
- `DELETE /api/boards/[boardId]/sprints/[sprintId]` - Delete sprint
- `GET /api/boards/[boardId]/tasks` - List tasks (filter by sprint, column, assignee)
- `POST /api/boards/[boardId]/tasks` - Create task
- `GET /api/boards/[boardId]/tasks/[taskId]` - Get task details
- `PUT /api/boards/[boardId]/tasks/[taskId]` - Update task (move, assign, etc.)
- `DELETE /api/boards/[boardId]/tasks/[taskId]` - Delete task
- `GET /api/boards/[boardId]/tasks/[taskId]/comments` - List comments
- `POST /api/boards/[boardId]/tasks/[taskId]/comments` - Add comment
- `GET /api/boards/[boardId]/labels` - List labels
- `POST /api/boards/[boardId]/labels` - Create label
- `PUT /api/boards/[boardId]/labels/[labelId]` - Update label
- `DELETE /api/boards/[boardId]/labels/[labelId]` - Delete label

### Admin User Management
- `GET /api/admin/users` - List all users (filter by status)
- `GET /api/admin/users/[userId]` - Get user details
- `PUT /api/admin/users/[userId]` - Update user (approve, reject, permissions)
- `DELETE /api/admin/users/[userId]` - Delete user

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications` - Mark all read / clear all
- `PUT /api/notifications/[notificationId]` - Mark as read
- `DELETE /api/notifications/[notificationId]` - Delete notification

## Permission Levels

Projects can be shared with groups at three levels:
- **read**: View-only access to project content
- **write**: Can create and edit content
- **admin**: Full access including project settings and sharing

## Security

- Passwords are hashed using bcrypt with 12 rounds
- Session data is encrypted using iron-session
- Credentials are encrypted using AES-256-CBC before storage
- Each credential has a unique IV for additional security

## License

MIT
