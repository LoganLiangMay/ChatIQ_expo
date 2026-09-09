// @ts-nocheck
// TECHNICAL DEBT: This file uses deprecated WebSQL-like API patterns
// TODO: Migrate to new expo-sqlite async/await API (openDatabaseAsync)
// The legacy API was removed in expo-sqlite@16+
// This file requires a complete rewrite to use the modern API
import * as SQLite from 'expo-sqlite';
import { Message } from '@/types/message';
import { Chat } from '@/types/chat';

// Stub for legacy API - THIS WILL NOT WORK AT RUNTIME
// Keeping structure for reference during future migration
const legacyOpenDatabase = (name: string) => {
  console.error('Legacy SQLite API is no longer available. Database operations will fail.');
  console.error('See: https://docs.expo.dev/versions/latest/sdk/sqlite/');
  return null;
};

class DatabaseService {
  private db: any | null = null;
  private initialized: boolean = false;
  
  async init() {
    if (this.initialized) {
      console.log('Database already initialized');
      return;
    }
    
    try {
      // STUB: Legacy API no longer available
      this.db = legacyOpenDatabase('messageai.db');
      if (!this.db) {
        console.warn('SQLite database initialization skipped - requires migration to new API');
        this.initialized = true;
        return;
      }
      await this.createTables();
      this.initialized = true;
      console.log('SQLite database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }
  
  private async createTables() {
    return new Promise<void>((resolve, reject) => {
      this.db!.transaction(
        (tx) => {
          // Chats table
          tx.executeSql(`
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
            )
          `);
          
          // Messages table
          tx.executeSql(`
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
            )
          `);
          
          // Indexes for performance
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId)');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_messages_syncStatus ON messages(syncStatus)');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_chats_updatedAt ON chats(updatedAt)');
        },
        (error) => {
          console.error('SQL error:', error);
          reject(error);
        },
        () => {
          console.log('Database tables created successfully');
          resolve();
        }
      );
    });
  }
  
  // === MESSAGE OPERATIONS ===
  
  async insertMessage(message: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          `INSERT INTO messages (
            id, chatId, senderId, senderName, content, type, imageUrl, 
            timestamp, syncStatus, deliveryStatus, readBy, deliveredTo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
          ],
          (_, result) => {
            console.log('Message inserted:', message.id);
            resolve();
          },
          (_, error) => {
            console.error('Insert message error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  async insertOrUpdateMessage(message: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          `INSERT OR REPLACE INTO messages (
            id, chatId, senderId, senderName, content, type, imageUrl,
            timestamp, syncStatus, deliveryStatus, readBy, deliveredTo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
          ],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  async getMessages(chatId: string, limitCount: number = 50): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp DESC LIMIT ?',
          [chatId, limitCount],
          (_, { rows }) => {
            const messages = rows._array.map((row: any) => ({
              ...row,
              readBy: JSON.parse(row.readBy || '[]'),
              deliveredTo: JSON.parse(row.deliveredTo || '[]')
            }));
            resolve(messages as Message[]);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  async getMessage(messageId: string): Promise<Message | null> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM messages WHERE id = ?',
          [messageId],
          (_, { rows }) => {
            if (rows.length > 0) {
              const row = rows._array[0];
              resolve({
                ...row,
                readBy: JSON.parse(row.readBy || '[]'),
                deliveredTo: JSON.parse(row.deliveredTo || '[]')
              } as Message);
            } else {
              resolve(null);
            }
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  async getPendingMessages(): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          "SELECT * FROM messages WHERE syncStatus IN ('pending', 'failed') ORDER BY timestamp ASC",
          [],
          (_, { rows }) => {
            const messages = rows._array.map((row: any) => ({
              ...row,
              readBy: JSON.parse(row.readBy || '[]'),
              deliveredTo: JSON.parse(row.deliveredTo || '[]')
            }));
            resolve(messages as Message[]);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  async updateMessageStatus(
    messageId: string,
    syncStatus: string,
    deliveryStatus: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          'UPDATE messages SET syncStatus = ?, deliveryStatus = ? WHERE id = ?',
          [syncStatus, deliveryStatus, messageId],
          () => {
            console.log('Message status updated:', messageId, syncStatus, deliveryStatus);
            resolve();
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  async getUnreadMessages(chatId: string, userId: string): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM messages WHERE chatId = ? AND senderId != ?',
          [chatId, userId],
          (_, { rows }) => {
            const messages = rows._array
              .map((row: any) => ({
                ...row,
                readBy: JSON.parse(row.readBy || '[]'),
                deliveredTo: JSON.parse(row.deliveredTo || '[]')
              }))
              .filter((msg: Message) => !msg.readBy?.includes(userId));
            
            resolve(messages as Message[]);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  /**
   * Mark a message as delivered for a specific user
   */
  async markMessageAsDelivered(messageId: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        // First, get the current deliveredTo array
        tx.executeSql(
          'SELECT deliveredTo FROM messages WHERE id = ?',
          [messageId],
          (_, { rows }) => {
            if (rows.length === 0) {
              reject(new Error('Message not found'));
              return;
            }
            
            const deliveredTo = JSON.parse(rows.item(0).deliveredTo || '[]');
            
            // Add userId if not already in the array
            if (!deliveredTo.includes(userId)) {
              deliveredTo.push(userId);
            }
            
            // Update the message
            tx.executeSql(
              'UPDATE messages SET deliveredTo = ?, deliveryStatus = ? WHERE id = ?',
              [JSON.stringify(deliveredTo), 'delivered', messageId],
              () => {
                console.log('Message marked as delivered:', messageId, userId);
                resolve();
              },
              (_, error) => {
                reject(error);
                return false;
              }
            );
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  /**
   * Mark a message as read for a specific user
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        // First, get the current readBy and deliveredTo arrays
        tx.executeSql(
          'SELECT readBy, deliveredTo FROM messages WHERE id = ?',
          [messageId],
          (_, { rows }) => {
            if (rows.length === 0) {
              reject(new Error('Message not found'));
              return;
            }
            
            const readBy = JSON.parse(rows.item(0).readBy || '[]');
            const deliveredTo = JSON.parse(rows.item(0).deliveredTo || '[]');
            
            // Add userId to readBy if not already there
            if (!readBy.includes(userId)) {
              readBy.push(userId);
            }
            
            // Add userId to deliveredTo if not already there (reading implies delivery)
            if (!deliveredTo.includes(userId)) {
              deliveredTo.push(userId);
            }
            
            // Update the message
            tx.executeSql(
              'UPDATE messages SET readBy = ?, deliveredTo = ?, deliveryStatus = ? WHERE id = ?',
              [JSON.stringify(readBy), JSON.stringify(deliveredTo), 'read', messageId],
              () => {
                console.log('Message marked as read:', messageId, userId);
                resolve();
              },
              (_, error) => {
                reject(error);
                return false;
              }
            );
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  /**
   * Mark all unread messages in a chat as read (batch operation)
   */
  async markAllMessagesAsRead(chatId: string, userId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        // First, get all unread messages
        tx.executeSql(
          'SELECT id, readBy, deliveredTo FROM messages WHERE chatId = ? AND senderId != ?',
          [chatId, userId],
          (_, { rows }) => {
            const messagesToUpdate: string[] = [];
            
            for (let i = 0; i < rows.length; i++) {
              const row = rows.item(i);
              const readBy = JSON.parse(row.readBy || '[]');
              
              // Only update if user hasn't read it yet
              if (!readBy.includes(userId)) {
                messagesToUpdate.push(row.id);
              }
            }
            
            if (messagesToUpdate.length === 0) {
              resolve([]);
              return;
            }
            
            // Update each message
            let completed = 0;
            messagesToUpdate.forEach((messageId) => {
              tx.executeSql(
                'SELECT readBy, deliveredTo FROM messages WHERE id = ?',
                [messageId],
                (_, { rows }) => {
                  const readBy = JSON.parse(rows.item(0).readBy || '[]');
                  const deliveredTo = JSON.parse(rows.item(0).deliveredTo || '[]');
                  
                  if (!readBy.includes(userId)) {
                    readBy.push(userId);
                  }
                  if (!deliveredTo.includes(userId)) {
                    deliveredTo.push(userId);
                  }
                  
                  tx.executeSql(
                    'UPDATE messages SET readBy = ?, deliveredTo = ?, deliveryStatus = ? WHERE id = ?',
                    [JSON.stringify(readBy), JSON.stringify(deliveredTo), 'read', messageId],
                    () => {
                      completed++;
                      if (completed === messagesToUpdate.length) {
                        console.log(`Marked ${completed} messages as read in chat ${chatId}`);
                        resolve(messagesToUpdate);
                      }
                    }
                  );
                }
              );
            });
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  // === SEARCH OPERATIONS ===
  
  /**
   * Search messages by content
   */
  async searchMessages(searchQuery: string, limitCount: number = 20): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          `SELECT * FROM messages 
           WHERE content LIKE ? 
           ORDER BY timestamp DESC 
           LIMIT ?`,
          [`%${searchQuery}%`, limitCount],
          (_, { rows }) => {
            const messages = rows._array.map((row: any) => ({
              ...row,
              readBy: JSON.parse(row.readBy || '[]'),
              deliveredTo: JSON.parse(row.deliveredTo || '[]')
            }));
            resolve(messages as Message[]);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  /**
   * Search chats by name
   */
  async searchChats(searchQuery: string, currentUserId: string): Promise<Chat[]> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          `SELECT * FROM chats 
           WHERE name LIKE ? 
           AND participants LIKE ?
           ORDER BY updatedAt DESC`,
          [`%${searchQuery}%`, `%${currentUserId}%`],
          (_, { rows }) => {
            const chats = rows._array.map((row: any) => ({
              ...row,
              participants: JSON.parse(row.participants || '[]'),
              admins: JSON.parse(row.admins || '[]'),
              lastMessage: row.lastMessage ? JSON.parse(row.lastMessage) : undefined
            }));
            resolve(chats as Chat[]);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  // === CHAT OPERATIONS ===
  
  async insertChat(chat: Chat): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          `INSERT OR REPLACE INTO chats (
            id, type, name, groupPicture, participants, admins, 
            lastMessage, updatedAt, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            chat.id,
            chat.type,
            chat.name || '',
            chat.groupPicture || '',
            JSON.stringify(chat.participants),
            JSON.stringify(chat.admins || []),
            JSON.stringify(chat.lastMessage || null),
            chat.updatedAt || Date.now(),
            chat.createdAt || Date.now()
          ],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  async getChats(userId: string): Promise<Chat[]> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          `SELECT * FROM chats WHERE participants LIKE ? ORDER BY updatedAt DESC`,
          [`%"${userId}"%`], // Match userId in JSON array
          (_, { rows }) => {
            const chats = rows._array.map((row: any) => ({
              ...row,
              participants: JSON.parse(row.participants),
              admins: JSON.parse(row.admins || '[]'),
              lastMessage: row.lastMessage ? JSON.parse(row.lastMessage) : null
            }));
            resolve(chats as Chat[]);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  async getChat(chatId: string): Promise<Chat | null> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM chats WHERE id = ?',
          [chatId],
          (_, { rows }) => {
            if (rows.length > 0) {
              const row = rows._array[0];
              resolve({
                ...row,
                participants: JSON.parse(row.participants),
                admins: JSON.parse(row.admins || '[]'),
                lastMessage: row.lastMessage ? JSON.parse(row.lastMessage) : null
              } as Chat);
            } else {
              resolve(null);
            }
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  async updateChat(chatId: string, updates: Partial<Chat>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
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
        
        tx.executeSql(
          `UPDATE chats SET ${setClauses.join(', ')} WHERE id = ?`,
          values,
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
  
  async deleteChat(chatId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.transaction((tx) => {
        // Delete messages first
        tx.executeSql('DELETE FROM messages WHERE chatId = ?', [chatId]);
        
        // Delete chat
        tx.executeSql(
          'DELETE FROM chats WHERE id = ?',
          [chatId],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
}

export const db = new DatabaseService();

export const initializeDatabase = async () => {
  await db.init();
};

