import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as db from './db';

describe('Financial Dashboard', () => {
  describe('getTodayRevenue', () => {
    it('should return today revenue with count and total USD', async () => {
      const result = await db.getTodayRevenue();
      
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('totalUSD');
      expect(result).toHaveProperty('orders');
      expect(typeof result.count).toBe('number');
      expect(typeof result.totalUSD).toBe('number');
      expect(Array.isArray(result.orders)).toBe(true);
    });

    it('should return zero revenue if no orders today', async () => {
      const result = await db.getTodayRevenue();
      
      // Should return valid structure even if no orders
      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.totalUSD).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMonthRevenue', () => {
    it('should return month revenue with count and total USD', async () => {
      const result = await db.getMonthRevenue();
      
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('totalUSD');
      expect(result).toHaveProperty('orders');
      expect(typeof result.count).toBe('number');
      expect(typeof result.totalUSD).toBe('number');
      expect(Array.isArray(result.orders)).toBe(true);
    });

    it('should return zero revenue if no orders this month', async () => {
      const result = await db.getMonthRevenue();
      
      // Should return valid structure even if no orders
      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.totalUSD).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getFinancialMetrics', () => {
    it('should return financial metrics with today, month, and total data', async () => {
      const exchangeRate = 30;
      const result = await db.getFinancialMetrics(exchangeRate);
      
      expect(result).toHaveProperty('today');
      expect(result).toHaveProperty('month');
      expect(result).toHaveProperty('total');
      
      // Check today metrics
      expect(result.today).toHaveProperty('ordersCount');
      expect(result.today).toHaveProperty('revenueUSD');
      expect(result.today).toHaveProperty('revenueTWD');
      
      // Check month metrics
      expect(result.month).toHaveProperty('ordersCount');
      expect(result.month).toHaveProperty('revenueUSD');
      expect(result.month).toHaveProperty('revenueTWD');
      
      // Check total metrics
      expect(result.total).toHaveProperty('revenueUSD');
      expect(result.total).toHaveProperty('revenueTWD');
    });

    it('should correctly convert USD to TWD using exchange rate', async () => {
      const exchangeRate = 30;
      const result = await db.getFinancialMetrics(exchangeRate);
      
      // Verify TWD = USD * exchangeRate
      const expectedTodayTWD = result.today.revenueUSD * exchangeRate;
      expect(result.today.revenueTWD).toBeCloseTo(expectedTodayTWD, 2);
      
      const expectedMonthTWD = result.month.revenueUSD * exchangeRate;
      expect(result.month.revenueTWD).toBeCloseTo(expectedMonthTWD, 2);
      
      const expectedTotalTWD = result.total.revenueUSD * exchangeRate;
      expect(result.total.revenueTWD).toBeCloseTo(expectedTotalTWD, 2);
    });

    it('should use default exchange rate of 30 if not provided', async () => {
      const result = await db.getFinancialMetrics();
      
      // Should use default rate of 30
      const expectedTodayTWD = result.today.revenueUSD * 30;
      expect(result.today.revenueTWD).toBeCloseTo(expectedTodayTWD, 2);
    });

    it('should handle different exchange rates', async () => {
      const rate1 = 30;
      const rate2 = 32;
      
      const result1 = await db.getFinancialMetrics(rate1);
      const result2 = await db.getFinancialMetrics(rate2);
      
      // Same USD revenue should produce different TWD with different rates
      if (result1.today.revenueUSD > 0) {
        const twd1 = result1.today.revenueTWD;
        const twd2 = result2.today.revenueTWD;
        
        // TWD should be proportional to exchange rate
        const ratio = twd2 / twd1;
        const expectedRatio = rate2 / rate1;
        expect(ratio).toBeCloseTo(expectedRatio, 1);
      }
    });
  });

  describe('getAllOrdersWithDetails', () => {
    it('should return array of orders with details', async () => {
      const result = await db.getAllOrdersWithDetails();
      
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        const order = result[0];
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('userId');
        expect(order).toHaveProperty('totalAmount');
        expect(order).toHaveProperty('status');
        expect(order).toHaveProperty('items');
        expect(order).toHaveProperty('user');
        expect(order).toHaveProperty('totalUSD');
        
        // Verify totalUSD is correctly calculated
        const expectedUSD = (order.totalAmount || 0) / 100;
        expect(order.totalUSD).toBe(expectedUSD);
      }
    });

    it('should include order items for each order', async () => {
      const result = await db.getAllOrdersWithDetails();
      
      if (result.length > 0) {
        const order = result[0];
        expect(Array.isArray(order.items)).toBe(true);
        
        if (order.items.length > 0) {
          const item = order.items[0];
          expect(item).toHaveProperty('id');
          expect(item).toHaveProperty('orderId');
          expect(item).toHaveProperty('productId');
          expect(item).toHaveProperty('quantity');
          expect(item).toHaveProperty('subtotal');
        }
      }
    });

    it('should include user information for each order', async () => {
      const result = await db.getAllOrdersWithDetails();
      
      if (result.length > 0) {
        const order = result[0];
        if (order.user) {
          expect(order.user).toHaveProperty('id');
          expect(order.user).toHaveProperty('name');
        }
      }
    });
  });
});
