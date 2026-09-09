/**
 * Database tests - ensure modern async/await API is used
 */

import * as fs from 'fs';
import * as path from 'path';

describe('SQLite Database', () => {
  it('should not use legacy openDatabase API', () => {
    const sqliteCode = fs.readFileSync(
      path.join(__dirname, '../services/database/sqlite.ts'),
      'utf8'
    );
    
    // Check that legacy API is NOT used
    expect(sqliteCode).not.toContain('SQLite.openDatabase(');
    expect(sqliteCode).not.toContain('.openDatabase(');
    
    // Check that modern API IS used
    expect(sqliteCode).toContain('openDatabaseAsync');
    expect(sqliteCode).toContain('SQLite.SQLiteDatabase');
  });

  it('should use async/await pattern for database operations', () => {
    const sqliteCode = fs.readFileSync(
      path.join(__dirname, '../services/database/sqlite.ts'),
      'utf8'
    );
    
    // Check for modern async methods
    expect(sqliteCode).toContain('runAsync');
    expect(sqliteCode).toContain('getAllAsync');
    expect(sqliteCode).toContain('getFirstAsync');
    expect(sqliteCode).toContain('execAsync');
  });

  it('should not contain transaction callbacks', () => {
    const sqliteCode = fs.readFileSync(
      path.join(__dirname, '../services/database/sqlite.ts'),
      'utf8'
    );
    
    // Legacy API used transaction callbacks
    expect(sqliteCode).not.toContain('.transaction(');
    expect(sqliteCode).not.toContain('tx.executeSql');
  });

  it('should have proper error handling for uninitialized db', () => {
    const sqliteCode = fs.readFileSync(
      path.join(__dirname, '../services/database/sqlite.ts'),
      'utf8'
    );
    
    // Should check if db is initialized
    expect(sqliteCode).toContain('Database not initialized');
  });
});
