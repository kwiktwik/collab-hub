/**
 * Development/Testing Script: Seed Test Data
 * 
 * Creates a test user with an organization for development.
 * 
 * Usage: npm run db:seed
 */

import { db } from '../lib/db';
import { users, organizations, organizationMembers, groups, groupMembers } from '../lib/db/schema';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seedTestData() {
  console.log('🌱 Development seed: Creating test data...');
  console.log('');

  // Check if any users already exist
  const existingUsers = await db.query.users.findMany({ columns: { id: true }, limit: 1 });

  if (existingUsers.length > 0) {
    console.log('⚠️  Users already exist in the database.');
    console.log('   Skipping seed...');
    console.log('');
    console.log('💡 To start fresh, delete the database and run db:push again.');
    process.exit(0);
  }

  const userId = uuidv4();
  const orgId = uuidv4();
  const groupId = uuidv4();
  
  // Test user credentials
  const userData = {
    username: 'testuser',
    email: 'test@collabhub.local',
    password: 'Test@123!',
    displayName: 'Test User'
  };

  // Hash password
  const passwordHash = await bcrypt.hash(userData.password, 12);

  // Create user
  await db.insert(users).values({
    id: userId,
    username: userData.username,
    email: userData.email,
    passwordHash,
    displayName: userData.displayName
  });

  // Create organization
  await db.insert(organizations).values({
    id: orgId,
    name: 'Test Organization',
    slug: 'test-org',
    description: 'A test organization for development',
    createdBy: userId
  });

  // Add user as owner of organization
  await db.insert(organizationMembers).values({
    id: uuidv4(),
    organizationId: orgId,
    userId,
    role: 'owner'
  });

  // Create a default group
  await db.insert(groups).values({
    id: groupId,
    organizationId: orgId,
    name: 'General',
    description: 'Default team group',
    createdBy: userId
  });

  // Add user to the group
  await db.insert(groupMembers).values({
    id: uuidv4(),
    groupId,
    userId,
    role: 'admin'
  });

  console.log('✅ Test data created successfully!');
  console.log('');
  console.log('📋 Test Account:');
  console.log(`   Username: ${userData.username}`);
  console.log(`   Password: ${userData.password}`);
  console.log(`   Email: ${userData.email}`);
  console.log('');
  console.log('🏢 Test Organization: Test Organization (test-org)');
  console.log('');
  console.log('🔐 This is for development/testing purposes.');
  console.log('   Anyone can register and create their own organizations.');
  
  process.exit(0);
}

seedTestData().catch((error) => {
  console.error('❌ Error seeding data:', error);
  process.exit(1);
});
