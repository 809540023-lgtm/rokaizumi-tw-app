import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { suppliers, purchases, orders } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { newsletter, b2bInquiries, reviews as productReviews } from "./routers/extra";

export const appRouter = router({
    // v4 新增（NL / B2B / ProductReviews）— A 版本身有 reviews route，故新版改名 productReviews
  newsletter,
  b2bInquiries,
  productReviews,
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Categories API
  categories: router({
    list: publicProcedure.query(() => db.getAllCategories()),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getCategoryById(input.id)),
  }),

  // Products API
  products: router({
    list: publicProcedure.query(() => db.getAllProducts()),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getProductById(input.id)),
    getByCategory: publicProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(({ input }) => db.getProductsByCategory(input.categoryId)),
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        price: z.number(),
        categoryId: z.number(),
        imageUrl: z.string().optional(),
        status: z.enum(['available', 'sold', 'reserved']).optional(),
        specifications: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = await db.isUserAdmin(ctx.user.id);
        if (!isAdmin) throw new Error('Unauthorized');
        return db.createProduct(input);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().optional(),
        categoryId: z.number().optional(),
        imageUrl: z.string().optional(),
        status: z.enum(['available', 'sold', 'reserved']).optional(),
        specifications: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = await db.isUserAdmin(ctx.user.id);
        if (!isAdmin) throw new Error('Unauthorized');
        const { id, ...data } = input;
        return db.updateProduct(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = await db.isUserAdmin(ctx.user.id);
        if (!isAdmin) throw new Error('Unauthorized');
        return db.deleteProduct(input.id);
      }),
    updateStock: protectedProcedure
      .input(z.object({
        id: z.number(),
        stock: z.number().min(0),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = await db.isUserAdmin(ctx.user.id);
        if (!isAdmin) throw new Error('Unauthorized');
        return db.updateProductStock(input.id, input.stock);
      }),
    decreaseStock: protectedProcedure
      .input(z.object({
        id: z.number(),
        quantity: z.number().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = await db.isUserAdmin(ctx.user.id);
        if (!isAdmin) throw new Error('Unauthorized');
        return db.decreaseProductStock(input.id, input.quantity);
      }),
    increaseStock: protectedProcedure
      .input(z.object({
        id: z.number(),
        quantity: z.number().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = await db.isUserAdmin(ctx.user.id);
        if (!isAdmin) throw new Error('Unauthorized');
        return db.increaseProductStock(input.id, input.quantity);
      }),
    getLowStock: publicProcedure
      .input(z.object({
        threshold: z.number().optional(),
      }))
      .query(({ input }) => db.getProductsWithLowStock(input.threshold)),
    search: publicProcedure
      .input(z.object({
        query: z.string().min(1),
      }))
      .query(({ input }) => db.searchProducts(input.query)),
    }),

  // Trips API
  trips: router({
    list: publicProcedure.query(() => db.getAllTrips()),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getTripById(input.id)),
    create: protectedProcedure
      .input(z.object({
        tripDate: z.string(),
        location: z.string(),
        status: z.enum(['scheduled', 'ongoing', 'completed']).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = await db.isUserAdmin(ctx.user.id);
        if (!isAdmin) throw new Error('Unauthorized');
        return db.createTrip({ ...input, createdByAdminId: ctx.user.id });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        tripDate: z.string().optional(),
        location: z.string().optional(),
        status: z.enum(['scheduled', 'ongoing', 'completed']).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = await db.isUserAdmin(ctx.user.id);
        if (!isAdmin) throw new Error('Unauthorized');
        const { id, ...data } = input;
        return db.updateTrip(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = await db.isUserAdmin(ctx.user.id);
        if (!isAdmin) throw new Error('Unauthorized');
        return db.deleteTrip(input.id);
      }),
  }),

  // Trip Videos API
  tripVideos: router({
    list: publicProcedure.query(() => db.getAllTripVideos()),
    getByTripId: publicProcedure
      .input(z.object({ tripId: z.number() }))
      .query(({ input }) => db.getTripVideosByTripId(input.tripId)),
    getLatest: publicProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(({ input }) => db.getLatestVideos(input.limit || 10)),
    create: protectedProcedure
      .input(z.object({
        tripId: z.number(),
        title: z.string(),
        description: z.string().optional(),
        videoUrl: z.string(),
        thumbnailUrl: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = await db.isUserAdmin(ctx.user.id);
        if (!isAdmin) throw new Error('Unauthorized');
        return db.createTripVideo(input);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = await db.isUserAdmin(ctx.user.id);
        if (!isAdmin) throw new Error('Unauthorized');
        return db.deleteTripVideo(input.id);
      }),
  }),

  // Shopping Cart API
  cart: router({
    list: protectedProcedure.query(({ ctx }) => db.getCartItemsByUserId(ctx.user.id)),
    add: protectedProcedure
      .input(z.object({ 
        productId: z.number(),
        quantity: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.addToCart({
          userId: ctx.user.id,
          productId: input.productId,
          quantity: input.quantity || 1,
        });
      }),
    updateQuantity: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        quantity: z.number(),
      }))
      .mutation(({ input }) => db.updateCartItemQuantity(input.id, input.quantity)),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.removeCartItem(input.id)),
    clear: protectedProcedure
      .mutation(({ ctx }) => db.clearCart(ctx.user.id)),
  }),

  // Orders API
  orders: router({
    list: protectedProcedure.query(({ ctx }) => db.getOrdersByUserId(ctx.user.id)),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getOrderById(input.id)),
    getBySessionId: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input, ctx }) => {
        // For now, return the latest order for the user with items
        // In production, you would query by Stripe session ID from database
        const orders = await db.getOrdersByUserId(ctx.user.id);
        if (orders.length === 0) return null;
        return await db.getOrderById(orders[0].id);
      }),
    create: protectedProcedure
      .input(z.object({
        shippingAddress: z.string(),
        contactName: z.string(),
        contactPhone: z.string(),
        contactEmail: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          productPrice: z.number(),
          quantity: z.number(),
          subtotal: z.number(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const totalAmount = input.items.reduce((sum, item) => sum + item.subtotal, 0);
        
        const orderId = await db.createOrder(
          {
            userId: ctx.user.id,
            totalAmount,
            shippingAddress: input.shippingAddress,
            contactName: input.contactName,
            contactPhone: input.contactPhone,
            contactEmail: input.contactEmail || null,
            notes: input.notes || null,
            status: 'pending',
          },
          input.items
        );
        
        // Clear cart after order is created
        await db.clearCart(ctx.user.id);
        
        return { orderId };
      }),
  }),

  // Reviews API
  reviews: router({
    getByProductId: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => db.getReviewsByProductId(input.productId)),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getReviewById(input.id)),
    getAverageRating: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => db.getAverageRating(input.productId)),
    create: protectedProcedure
      .input(z.object({
        productId: z.number(),
        rating: z.number().min(1).max(5),
        title: z.string(),
        comment: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createReview({
          productId: input.productId,
          userId: ctx.user.id,
          rating: input.rating,
          title: input.title,
          comment: input.comment || null,
        });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        rating: z.number().min(1).max(5).optional(),
        title: z.string().optional(),
        comment: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const review = await db.getReviewById(input.id);
        if (!review || review.userId !== ctx.user.id) throw new Error('Unauthorized');
        const { id, ...data } = input;
        return db.updateReview(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const review = await db.getReviewById(input.id);
        if (!review || review.userId !== ctx.user.id) throw new Error('Unauthorized');
        return db.deleteReview(input.id);
      }),
  }),

  // AI Chat API
  ai: router({
    chat: publicProcedure
      .input(z.object({
        message: z.string(),
        language: z.enum(['zh', 'en', 'ja']).optional(),
      }))
      .mutation(async ({ input }) => {
        const systemPrompt = input.language === 'zh'
          ? '你是ろかいずみ合同会社的 AI 客服助理。我們是一家專業的日本百元商品和老人看護器材出口公司，服務全球包括台灣。請友善、專業地回答客戶的問題。如果客戶問到產品相關問題，請介紹我們的主要產品類別：日本百元商品（廚房用品、收納用品、文具、日用百貨、清潔用品、玩具雜貨、美妆保養、食品零食）和老人看護器材（健康監測、安全監控、床邊照護、復健器材、生活輔具、行動輔助、衛浴安全、護理用品）。'
          : input.language === 'en'
          ? 'You are an AI customer service assistant for ろかいずみ合同会社. We are a professional company specializing in exporting Japanese 100-yen products and elderly care equipment, serving customers worldwide including Taiwan. Please answer customer questions in a friendly and professional manner. If customers ask about products, please introduce our main product categories: Japanese 100-yen products (kitchen supplies, storage items, stationery, daily necessities, cleaning supplies, toys and miscellaneous goods, beauty and skincare, food and snacks) and elderly care equipment (health monitoring, safety monitoring, bedside care, rehabilitation equipment, daily living aids, mobility aids, bathroom safety, nursing supplies).'
          : 'あなたはろかいずみ合同会社のAIカスタマーサービスアシスタントです。私たちは、日本の100円商品と高齢者介護機器の輸出を専門とする会社で、台湾を含む世界中のお客様にサービスを提供しています。お客様の質問に親切かつ専門的にお答えください。製品について質問された場合は、主要な製品カテゴリを紹介してください：日本の100円商品（キッチン用品、収納用品、文具、日用品、清掃用品、おもちゃ雑貨、美容スキンケア、食品お菓子）と高齢者介護機器（健康モニタリング、安全監視、ベッドサイドケア、リハビリ機器、生活補助具、移動補助具、浴室安全、介護用品）。';

        const response = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input.message },
          ],
        });

        const content = response.choices[0]?.message?.content;
        const responseText = typeof content === 'string' 
          ? content 
          : Array.isArray(content) 
          ? content.map(c => c.type === 'text' ? c.text : '').join('') 
          : '抱歉，我現在無法回答。';

        return {
          response: responseText,
        };
      }),
  }),

  // Wishlist API
  wishlist: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      return await db.getWishlistByUser(ctx.user.id);
    }),
    add: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        return await db.addToWishlist(ctx.user.id, input.productId);
      }),
    remove: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        return await db.removeFromWishlist(ctx.user.id, input.productId);
      }),
    isInWishlist: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user) return false;
        return await db.isInWishlist(ctx.user.id, input.productId);
      }),
  }),

  // Stripe Payments API
  payments: router({
    createCheckoutSession: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          productPrice: z.number(),
          quantity: z.number(),
          subtotal: z.number(),
        })),
        shippingInfo: z.object({
          name: z.string(),
          phone: z.string(),
          address: z.string(),
          notes: z.string().optional(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        try {
          // Create order first
          const orderId = await db.createOrder(
            {
              userId: ctx.user.id,
              shippingAddress: input.shippingInfo.address,
              contactName: input.shippingInfo.name,
              contactPhone: input.shippingInfo.phone,
              notes: input.shippingInfo.notes || '',
              status: 'pending',
              totalAmount: input.items.reduce((sum, item) => sum + item.subtotal, 0),
            },
            input.items.map(item => ({
              productId: item.productId,
              productName: item.productName,
              productPrice: item.productPrice,
              quantity: item.quantity,
              subtotal: item.subtotal,
            }))
          );

          // Create Stripe checkout session
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: input.items.map((item) => ({
              price_data: {
                currency: 'jpy',
                product_data: {
                  name: item.productName,
                },
                unit_amount: Math.round(item.productPrice * 100),
              },
              quantity: item.quantity,
            })),
            mode: 'payment',
            success_url: `${ctx.req.headers.origin}/orders?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${ctx.req.headers.origin}/checkout`,
            customer_email: ctx.user.email,
            metadata: {
              orderId: orderId.toString(),
              userId: ctx.user.id.toString(),
            },
          });

          return {
            url: session.url,
            sessionId: session.id,
          };
        } catch (error: any) {
          throw new Error(`Failed to create checkout session: ${error.message}`);
        }
      }),

  // Admin routes - Order Management
  orders: adminProcedure
    .query(async ({ ctx }) => {
      return await db.getOrdersByUserId(ctx.user.id);
    }),

  // Admin routes - Supplier Management
  suppliers: adminProcedure
    .query(async () => {
      return await db.getAllSuppliers();
    }),

  createSupplier: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      contactPerson: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      code: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await db.createSupplier(input as any);
    }),

  // Admin routes - Purchase Management
  purchases: adminProcedure
    .query(async ({ ctx }) => {
      return [];
    }),

  createPurchase: adminProcedure
    .input(z.object({
      productId: z.number(),
      supplierId: z.number(),
      quantity: z.number().min(1),
      purchasePrice: z.number().min(0),
      purchaseDate: z.date().optional(),
      deliveryDate: z.date().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return { success: true };
    }),

  }),

  admin: router({
    // Financial Dashboard
    financialMetrics: protectedProcedure
      .input(z.object({
        exchangeRateUSDtoTWD: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const exchangeRate = input?.exchangeRateUSDtoTWD || 30;
        return await db.getFinancialMetrics(exchangeRate);
      }),

    todayRevenue: protectedProcedure
      .query(async () => {
        return await db.getTodayRevenue();
      }),

    monthRevenue: protectedProcedure
      .query(async () => {
        return await db.getMonthRevenue();
      }),

    allOrdersWithDetails: protectedProcedure
      .query(async () => {
        return await db.getAllOrdersWithDetails();
      }),
    // Orders Management
    orders: protectedProcedure
      .query(async () => {
        return await db.getAllOrdersWithDetails();
      }),

    orderById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getOrderById(input.id);
      }),

    updateOrderStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['pending', 'paid', 'shipped', 'completed', 'cancelled']),
      }))
      .mutation(async ({ input }) => {
        return await db.updateOrderStatus(input.id, input.status);
      }),

    // Products Management
    products: protectedProcedure
      .query(async () => {
        return await db.getAllProducts();
      }),

    productById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProductById(input.id);
      }),

    deleteProduct: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteProduct(input.id);
      }),

    lowStockProducts: protectedProcedure
      .query(async () => {
        return await db.getLowStockProducts();
      }),

    createProduct: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.number().min(0),
        categoryId: z.number(),
        specifications: z.string().optional(),
        images: z.array(z.string()).optional(),
        stock: z.number().min(0).optional(),
        status: z.enum(['available', 'sold', 'reserved']).optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createProduct({
          name: input.name,
          description: input.description,
          price: input.price,
          categoryId: input.categoryId,
          specifications: input.specifications,
          imageUrl: input.images?.[0],
          images: input.images?.slice(1), // Store remaining images
          stock: input.stock || 1,
          status: input.status || 'available',
        } as any);
      }),

    createProductPublic: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.number().min(0),
        categoryId: z.number(),
        specifications: z.string().optional(),
        images: z.array(z.string()).optional(),
        stock: z.number().min(0).optional(),
        status: z.enum(['available', 'sold', 'reserved']).optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createProduct({
          name: input.name,
          description: input.description,
          price: input.price,
          categoryId: input.categoryId,
          specifications: input.specifications,
          imageUrl: input.images?.[0],
          images: input.images?.slice(1), // Store remaining images
          stock: input.stock || 1,
          status: input.status || 'available',
        } as any);
      }),

    updateProduct: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().optional(),
        categoryId: z.number().optional(),
        specifications: z.string().optional(),
        images: z.array(z.string()).optional(),
        stock: z.number().optional(),
        lowStockThreshold: z.number().optional(),
        status: z.enum(['available', 'sold', 'reserved']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        const data: any = {};
        if (updateData.name !== undefined) data.name = updateData.name;
        if (updateData.description !== undefined) data.description = updateData.description;
        if (updateData.price !== undefined) data.price = updateData.price;
        if (updateData.categoryId !== undefined) data.categoryId = updateData.categoryId;
        if (updateData.specifications !== undefined) data.specifications = updateData.specifications;
        if (updateData.images !== undefined && updateData.images.length > 0) {
          data.imageUrl = updateData.images[0];
          data.images = updateData.images.slice(1); // Store remaining images in images field
        }
        if (updateData.stock !== undefined) data.stock = updateData.stock;
        if (updateData.lowStockThreshold !== undefined) data.lowStockThreshold = updateData.lowStockThreshold;
        if (updateData.status !== undefined) data.status = updateData.status;
        return await db.updateProduct(id, data);
      }),

    // Suppliers Management
    suppliers: protectedProcedure
      .query(async () => {
        return await db.getAllSuppliers();
      }),

    createSupplier: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        contactPerson: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        code: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createSupplier(input as any);
      }),

    updateSupplier: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        contactPerson: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        code: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateSupplier(id, data as any);
      }),

    deleteSupplier: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteSupplier(input.id);
      }),

    // Purchases Management
    purchases: protectedProcedure
      .query(async () => {
        return await db.getAllPurchases();
      }),

    createPurchase: protectedProcedure
      .input(z.object({
        productId: z.number(),
        supplierId: z.number(),
        quantity: z.number().min(1),
        purchasePrice: z.number().min(0),
        purchaseDate: z.date().optional(),
        deliveryDate: z.date().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createPurchase(input as any);
      }),

    // Users Management
    users: protectedProcedure
      .query(async () => {
        return await db.getAllUsers();
      }),

    updateUserRole: protectedProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['admin', 'user']),
      }))
      .mutation(async ({ input }) => {
        return await db.updateUserRole(input.userId, input.role);
      }),

    // Image Upload
    uploadImage: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.fileData, 'base64');
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileKey = `products/${timestamp}-${randomSuffix}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.contentType);
        return { url, key: fileKey };
      }),

    // Multiple Images Upload
    uploadImages: protectedProcedure
      .input(z.object({
        images: z.array(z.object({
          fileName: z.string(),
          fileData: z.string(), // base64 encoded
          contentType: z.string(),
        })).max(5),
      }))
      .mutation(async ({ input }) => {
        const uploadedImages: { url: string; key: string }[] = [];
        for (const image of input.images) {
          const buffer = Buffer.from(image.fileData, 'base64');
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const fileKey = `products/${timestamp}-${randomSuffix}-${image.fileName}`;
          const { url } = await storagePut(fileKey, buffer, image.contentType);
          uploadedImages.push({ url, key: fileKey });
        }
        return { images: uploadedImages };
      }),

    // Announcements Management
    announcements: protectedProcedure
      .query(async () => {
        return await db.getAllAnnouncements();
      }),

    createAnnouncement: protectedProcedure
      .input(z.object({
        contentZh: z.string().min(1),
        contentEn: z.string().optional(),
        contentJa: z.string().optional(),
        isActive: z.boolean().optional(),
        priority: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createAnnouncement(input as any);
      }),

    updateAnnouncement: protectedProcedure
      .input(z.object({
        id: z.number(),
        contentZh: z.string().optional(),
        contentEn: z.string().optional(),
        contentJa: z.string().optional(),
        isActive: z.boolean().optional(),
        priority: z.number().optional(),
        startDate: z.date().nullable().optional(),
        endDate: z.date().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateAnnouncement(id, data as any);
      }),

    deleteAnnouncement: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteAnnouncement(input.id);
      }),

    toggleAnnouncementActive: protectedProcedure
      .input(z.object({
        id: z.number(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        return await db.toggleAnnouncementActive(input.id, input.isActive);
      }),
  }),

  // Public Announcements API
  announcements: router({
    active: publicProcedure.query(() => db.getActiveAnnouncements()),
  }),

  // OpenClaw API Logs
  apiLogs: router({
    list: adminProcedure
      .input(z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(({ input }) => db.getApiLogs(input.limit, input.offset)),
    stats: adminProcedure.query(() => db.getApiStats()),
  }),
});

export type AppRouter = typeof appRouter;
