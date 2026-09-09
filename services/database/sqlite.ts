/**
 * SQLite Database Service
 * Modern async/await API (Expo SDK 57+)
 */

import * as SQLite from 'expo-sqlite';
import { Message } from '@/types/message';
import { Chat } from '@/types/chat';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized: boolean = false;
  
  async init() {
    if (this.initialized) {
      console.log('Database already initialized');
      return;
    }
    
    try {
      // Open database with new async API
      this.db = await SQLite.openDatabaseAsync('messageai.db');
      
      // Enable WAL mode for better performance
      await this.db.execAsync('PRAGMA journal_mode = WAL');
      
      await this.createTables();
      this.initialized = true;
      console.log('SQLite database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }
  
  private async createTables() {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT,
        groupPicture TEXT,
        participants TEXT NOT NULL,
        admins TEXT,
        lastMessage TEXT,
        updatedAt INTEGER,
        createdAt INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        senderName TEXT NOT NULL,
        content TEXT,
        type TEXT NOT NULL,
        imageUrl TEXT,
        timestamp INTEGER NOT NULL,
        syncStatus TEXT DEFAULT 'pending',
        deliveryStatus TEXT DEFAULT 'sending',
        readBy TEXT,
        deliveredTo TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_syncStatus ON messages(syncStatus);
      CREATE INDEX IF NOT EXISTS idx_chats_updatedAt ON chats(updatedAt);
    `);
    
    console.log('Database tables created successfully');
  }
  
  // === MESSAGE OPERATIONS ===
  
  async insertMessage(message: Message): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      `INSERT INTO messages (
        id, chatId, senderId, senderName, content, type, imageUrl, 
        timestamp, syncStatus, deliveryStatus, readBy, deliveredTo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      message.id,
      message.chatId,
      message.senderId,
      message.senderName,
      message.content || '',
      message.type,
      message.imageUrl || '',
      message.timestamp,
      message.syncStatus || 'pending',
      message.deliveryStatus || 'sending',
      JSON.stringify(message.readBy || [message.senderId]),
      JSON.stringify(message.deliveredTo || [message.senderId])
    );
    
    console.log('Message inserted:', message.id);
  }
  
  async insertOrUpdateMessage(message: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO messages (
        id, chatId, senderId, senderName, content, type, imageUrl,
        timestamp, syncStatus, deliveryStatus, readBy, deliveredTo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      message.id,
      message.chatId,
      message.senderId,
      message.senderName || 'Unknown',
      message.content || '',
      message.type,
      message.imageUrl || '',
      message.timestamp,
      message.syncStatus || 'synced',
      message.deliveryStatus || 'delivered',
      JSON.stringify(message.readBy || []),
      JSON.stringify(message.deliveredTo || [])
    );
  }
  
  async getMessages(chatId: string, limitCount: number = 50): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp DESC LIMIT ?',
      chatId,
      limitCount
    );
    
    return rows.map((row) => ({
      ...row,
      readBy: JSON.parse(row.readBy || '[]'),
      deliveredTo: JSON.parse(row.deliveredTo || '[]')
    })) as Message[];
  }
  
  async getMessage(messageId: string): Promise<Message | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.getFirstAsync<any>(
      'SELECT * FROM messages WHERE id = ?',
      messageId
    );
    
    if (!row) return null;
    
    return {
      ...row,
      readBy: JSON.parse(row.readBy || '[]'),
      deliveredTo: JSON.parse(row.deliveredTo || '[]')
    } as Message;
  }
  
  async getPendingMessages(): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.getAllAsync<any>(
      "SELECT * FROM messages WHERE syncStatus IN ('pending', 'failed') ORDER BY timestamp ASC"
    );
    
    return rows.map((row) => ({
      ...row,
      readBy: JSON.parse(row.readBy || '[]'),
      deliveredTo: JSON.parse(row.deliveredTo || '[]')
    })) as Message[];
  }
  
  async updateMessageStatus(
    messageId: string,
    syncStatus: string,
    deliveryStatus: string
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      'UPDATE messages SET syncStatus = ?, deliveryStatus = ? WHERE id = ?',
      syncStatus,
      deliveryStatus,
      messageId
    );
    
    console.log('Message status updated:', messageId, syncStatus, deliveryStatus);
  }
  
  async getUnreadMessages(chatId: string, userId: string): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM messages WHERE chatId = ? AND senderId != ?',
      chatId,
      userId
    );
    
    const messages = rows
      .map((row) => ({
        ...row,
        readBy: JSON.parse(row.readBy || '[]'),
        deliveredTo: JSON.parse(row.deliveredTo || '[]')
      }))
      .filter((msg: any) => !msg.readBy?.includes(userId));
    
    return messages as Message[];
  }
  
  async markMessageAsDelivered(messageId: string, userId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.getFirstAsync<{ deliveredTo: string }>(
      'SELECT deliveredTo FROM messages WHERE id = ?',
      messageId
    );
    
    if (!row) {
      throw new Error('Message not found');
    }
    
    const deliveredTo = JSON.parse(row.deliveredTo || '[]');
    
    if (!deliveredTo.includes(userId)) {
      deliveredTo.push(userId);
    }
    
    await this.db.runAsync(
      'UPDATE messages SET deliveredTo = ?, deliveryStatus = ? WHERE id = ?',
      JSON.stringify(deliveredTo),
      'delivered',
      messageId
    );
    
    console.log('Message marked as delivered:', messageId, userId);
  }
  
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.getFirstAsync<{ readBy: string; deliveredTo: string }>(
      'SELECT readBy, deliveredTo FROM messages WHERE id = ?',
      messageId
    );
    
    if (!row) {
      throw new Error('Message not found');
    }
    
    const readBy = JSON.parse(row.readBy || '[]');
    const deliveredTo = JSON.parse(row.deliveredTo || '[]');
    
    if (!readBy.includes(userId)) {
      readBy.push(userId);
    }
    
    if (!deliveredTo.includes(userId)) {
      deliveredTo.push(userId);
    }
    
    await this.db.runAsync(
      'UPDATE messages SET readBy = ?, deliveredTo = ?, deliveryStatus = ? WHERE id = ?',
      JSON.stringify(readBy),
      JSON.stringify(deliveredTo),
      'read',
      messageId
    );
    
    console.log('Message marked as read:', messageId, userId);
  }
  
  async markAllMessagesAsRead(chatId: string, userId: string): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.getAllAsync<{ id: string; readBy: string; deliveredTo: string }>(
      'SELECT id, readBy, deliveredTo FROM messages WHERE chatId = ? AND senderId != ?',
      chatId,
      userId
    );
    
    const messagesToUpdate: string[] = [];
    
    for (const row of rows) {
      const readBy = JSON.parse(row.readBy || '[]');
      
      if (!readBy.includes(userId)) {
        messagesToUpdate.push(row.id);
        
        const deliveredTo = JSON.parse(row.deliveredTo || '[]');
        
        if (!readBy.includes(userId)) {
          readBy.push(userId);
        }
        if (!deliveredTo.includes(userId)) {
          deliveredTo.push(userId);
        }
        
        await this.db.runAsync(
          'UPDATE messages SET readBy = ?, deliveredTo = ?, deliveryStatus = ? WHERE id = ?',
          JSON.stringify(readBy),
          JSON.stringify(deliveredTo),
          'read',
          row.id
        );
      }
    }
    
    if (messagesToUpdate.length > 0) {
      console.log(`Marked ${messagesToUpdate.length} messages as read in chat ${chatId}`);
    }
    
    return messagesToUpdate;
  }
  
  // === SEARCH OPERATIONS ===
  
  async searchMessages(searchQuery: string, limitCount: number = 20): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM messages 
       WHERE content LIKE ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      `%${searchQuery}%`,
      limitCount
    );
    
    return rows.map((row) => ({
      ...row,
      readBy: JSON.parse(row.readBy || '[]'),
      deliveredTo: JSON.parse(row.deliveredTo || '[]')
    })) as Message[];
  }
  
  async searchChats(searchQuery: string, currentUserId: string): Promise<Chat[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM chats 
       WHERE name LIKE ? 
       AND participants LIKE ?
       ORDER BY updatedAt DESC`,
      `%${searchQuery}%`,
      `%${currentUserId}%`
    );
    
    return rows.map((row) => ({
      ...row,
      participants: JSON.parse(row.participants || '[]'),
      admins: JSON.parse(row.admins || '[]'),
      lastMessage: row.lastMessage ? JSON.parse(row.lastMessage) : undefined
    })) as Chat[];
  }
  
  // === CHAT OPERATIONS ===
  
  async insertChat(chat: Chat): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO chats (
        id, type, name, groupPicture, participants, admins, 
        lastMessage, updatedAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      chat.id,
      chat.type,
      chat.name || '',
      chat.groupPicture || '',
      JSON.stringify(chat.participants),
      JSON.stringify(chat.admins || []),
      JSON.stringify(chat.lastMessage || null),
      chat.updatedAt || Date.now(),
      chat.createdAt || Date.now()
    );
  }
  
  async getChats(userId: string): Promise<Chat[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM chats WHERE participants LIKE ? ORDER BY updatedAt DESC`,
      `%"${userId}"%`
    );
    
    return rows.map((row) => ({
      ...row,
      participants: JSON.parse(row.participants),
      admins: JSON.parse(row.admins || '[]'),
      lastMessage: row.lastMessage ? JSON.parse(row.lastMessage) : null
    })) as Chat[];
  }
  
  async getChat(chatId: string): Promise<Chat | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.getFirstAsync<any>(
      'SELECT * FROM chats WHERE id = ?',
      chatId
    );
    
    if (!row) return null;
    
    return {
      ...row,
      participants: JSON.parse(row.participants),
      admins: JSON.parse(row.admins || '[]'),
      lastMessage: row.lastMessage ? JSON.parse(row.lastMessage) : null
    } as Chat;
  }
  
  async updateChat(chatId: string, updates: Partial<Chat>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const setClauses: string[] = [];
    const values: any[] = [];
    
    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.groupPicture !== undefined) {
      setClauses.push('groupPicture = ?');
      values.push(updates.groupPicture);
    }
    if (updates.participants !== undefined) {
      setClauses.push('participants = ?');
      values.push(JSON.stringify(updates.participants));
    }
    if (updates.admins !== undefined) {
      setClauses.push('admins = ?');
      values.push(JSON.stringify(updates.admins));
    }
    if (updates.lastMessage !== undefined) {
      setClauses.push('lastMessage = ?');
      values.push(JSON.stringify(updates.lastMessage));
    }
    
    setClauses.push('updatedAt = ?');
    values.push(Date.now());
    
    values.push(chatId);
    
    await this.db.runAsync(
      `UPDATE chats SET ${setClauses.join(', ')} WHERE id = ?`,
      ...values
    );
  }
  
  async deleteChat(chatId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Delete messages first
    await this.db.runAsync('DELETE FROM messages WHERE chatId = ?', chatId);
    
    // Delete chat
    await this.db.runAsync('DELETE FROM chats WHERE id = ?', chatId);
  }
}

export const db = new DatabaseService();

export const initializeDatabase = async () => {
  await db.init();
};
