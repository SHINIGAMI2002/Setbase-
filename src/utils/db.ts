/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BasePoint } from '../types';

// Let's define the local DB schemas
export interface UserSession {
  uid: string;
  email: string;
  loggedInAt: number;
}

export interface LocalUser {
  uid: string;
  email: string;
  passwordHash: string;
  salt: string;
  securityQuestion: string;
  securityAnswerHash: string;
  securityAnswerSalt: string;
  createdAt: number;
}

export interface SyncRecord {
  id: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'point';
  entityId: string;
  timestamp: number;
}

const DB_NAME = 'geosurvey_secure_db';
const DB_VERSION = 1;

// Initialize IndexedDB
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB failed to open:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // 1. Users Store
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'uid' });
        // index by email for quick checks
        const usersStore = request.transaction?.objectStore('users');
        usersStore?.createIndex('email', 'email', { unique: true });
      }

      // 2. Points Store (Linked to user, has offline sync fields)
      if (!db.objectStoreNames.contains('points')) {
        const pointsStore = db.createObjectStore('points', { keyPath: 'id' });
        pointsStore.createIndex('userId', 'userId', { unique: false });
        pointsStore.createIndex('synced', 'synced', { unique: false });
      }

      // 3. Sync Queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }
    };
  });
}

// Native cryptography helpers using Web Crypto API
export class CryptoHelper {
  static generateSalt(): string {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static async hashString(input: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input + salt);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}

// User Auth implementation
export class AuthService {
  static async signup(
    emailStr: string,
    passwordStr: string,
    questionStr: string,
    answerStr: string
  ): Promise<UserSession> {
    const db = await initDB();
    const email = emailStr.toLowerCase().trim();

    if (!email || !passwordStr || !questionStr || !answerStr) {
      throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน');
    }

    // Check if user already exists
    const existing = await this.getUserByEmail(email);
    if (existing) {
      throw new Error('อีเมลนี้เคยลงทะเบียนไว้แล้ว');
    }

    const uid = 'usr_' + CryptoHelper.generateSalt().substring(0, 10);
    const salt = CryptoHelper.generateSalt();
    const passwordHash = await CryptoHelper.hashString(passwordStr, salt);

    const answerSalt = CryptoHelper.generateSalt();
    const answerHash = await CryptoHelper.hashString(
      answerStr.toLowerCase().trim(),
      answerSalt
    );

    const newUser: LocalUser = {
      uid,
      email,
      passwordHash,
      salt,
      securityQuestion: questionStr,
      securityAnswerHash: answerHash,
      securityAnswerSalt: answerSalt,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const request = store.add(newUser);

      request.onsuccess = () => {
        const session = { uid, email, loggedInAt: Date.now() };
        localStorage.setItem('geosurvey_session', JSON.stringify(session));
        resolve(session);
      };

      request.onerror = () => {
        reject(new Error('เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ใช้งาน'));
      };
    });
  }

  static async login(emailStr: string, passwordStr: string): Promise<UserSession> {
    const email = emailStr.toLowerCase().trim();
    const user = await this.getUserByEmail(email);

    if (!user) {
      throw new Error('ไม่พบอีเมลผู้ใช้งานนี้ในระบบ');
    }

    const calculatedHash = await CryptoHelper.hashString(passwordStr, user.salt);
    if (calculatedHash !== user.passwordHash) {
      throw new Error('รหัสผ่านไม่ถูกต้อง โปรดลองอีกครั้ง');
    }

    const session: UserSession = {
      uid: user.uid,
      email: user.email,
      loggedInAt: Date.now(),
    };

    localStorage.setItem('geosurvey_session', JSON.stringify(session));
    return session;
  }

  static logout(): void {
    localStorage.removeItem('geosurvey_session');
  }

  static getCurrentSession(): UserSession | null {
    const stored = localStorage.getItem('geosurvey_session');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  static async resetPassword(
    emailStr: string,
    answerStr: string,
    newPasswordStr: string
  ): Promise<boolean> {
    const email = emailStr.toLowerCase().trim();
    const user = await this.getUserByEmail(email);

    if (!user) {
      throw new Error('ไม่พบอีเมลผู้ใช้งานนี้ในระบบ');
    }

    const computedAnswerHash = await CryptoHelper.hashString(
      answerStr.toLowerCase().trim(),
      user.securityAnswerSalt
    );

    if (computedAnswerHash !== user.securityAnswerHash) {
      throw new Error('คำตอบคำถามความปลอดภัยไม่ถูกต้อง');
    }

    const newSalt = CryptoHelper.generateSalt();
    const newHash = await CryptoHelper.hashString(newPasswordStr, newSalt);

    const updatedUser: LocalUser = {
      ...user,
      passwordHash: newHash,
      salt: newSalt,
    };

    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const request = store.put(updatedUser);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('บันทึกรหัสผ่านใหม่ไม่สำเร็จ'));
    });
  }

  static async getUserByEmail(email: string): Promise<LocalUser | null> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const index = store.index('email');
      const request = index.get(email);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// Survey Points manager with Sync System
export class PointService {
  static async getPoints(userId: string): Promise<BasePoint[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('points', 'readonly');
      const store = tx.objectStore('points');
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        // Filter out soft-deleted points
        const results = request.result || [];
        const activePoints = results
          .filter((pt: any) => !pt.isDeleted)
          .map((pt: any) => {
            const { userId: _, synced: __, isDeleted: ___, ...point } = pt;
            return point as BasePoint;
          });
        resolve(activePoints);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  static async savePoint(
    point: BasePoint,
    userId: string,
    isNew: boolean
  ): Promise<void> {
    const db = await initDB();
    const isOnline = navigator.onLine;

    const record = {
      ...point,
      userId,
      synced: isOnline,
      updatedAt: Date.now(),
      isDeleted: false,
    };

    // Store point locally
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('points', 'readwrite');
      const store = tx.objectStore('points');
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // If unsynced, queue it
    if (!isOnline) {
      await this.queueSync(point.id, isNew ? 'create' : 'update');
    }
  }

  static async deletePoint(pointId: string, userId: string): Promise<void> {
    const db = await initDB();
    const isOnline = navigator.onLine;

    // Soft delete locally first
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('points', 'readwrite');
      const store = tx.objectStore('points');
      const getReq = store.get(pointId);

      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data) {
          data.isDeleted = true;
          data.synced = isOnline;
          data.updatedAt = Date.now();
          const putReq = store.put(data);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });

    if (!isOnline) {
      await this.queueSync(pointId, 'delete');
    }
  }

  static async queueSync(
    entityId: string,
    action: 'create' | 'update' | 'delete'
  ): Promise<void> {
    const db = await initDB();
    const syncItem: SyncRecord = {
      id: 'sn_' + CryptoHelper.generateSalt().substring(0, 10),
      action,
      entityType: 'point',
      entityId,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const request = store.put(syncItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Execute sync queue to server (mock integration + fully functional log simulation)
  static async syncOfflineData(userId: string): Promise<{
    syncedCount: number;
    errors: string[];
  }> {
    if (!navigator.onLine) {
      return { syncedCount: 0, errors: ['คุณยังไม่ได้เชื่อมต่ออินเทอร์เน็ต'] };
    }

    const db = await initDB();
    const queue: SyncRecord[] = await new Promise((resolve) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
    });

    if (queue.length === 0) {
      return { syncedCount: 0, errors: [] };
    }

    // Sort queue by timestamp to preserve correctness of changes
    queue.sort((a, b) => a.timestamp - b.timestamp);

    let syncedCount = 0;
    const errors: string[] = [];

    for (const actionRecord of queue) {
      try {
        // Fetch raw data representing this point from points db
        const pointData: any = await new Promise((resolve, reject) => {
          const tx = db.transaction('points', 'readonly');
          const store = tx.objectStore('points');
          const request = store.get(actionRecord.entityId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        // Simulating the secure API Request payload block
        // Wait 300 ms to make the sync visually aesthetic and realistic
        await new Promise((r) => setTimeout(r, 200));

        // If the point is found, we mark it synced locally!
        if (pointData) {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('points', 'readwrite');
            const store = tx.objectStore('points');
            pointData.synced = true;
            const request = store.put(pointData);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }

        // Successfully synced/removed from queue
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('sync_queue', 'readwrite');
          const store = tx.objectStore('sync_queue');
          const request = store.delete(actionRecord.id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        syncedCount++;
      } catch (err) {
        errors.push(`เกิดข้อผิดพลาดในการซิงค์ข้อมูลจุด ${actionRecord.entityId}: ${err}`);
      }
    }

    return { syncedCount, errors };
  }
}
