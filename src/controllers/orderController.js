const supabase = require("../config/supabase");

const orderController = {
  getOrders: async (req, res) => {
    try {
      const userId = req.user.id;
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_items (
            *,
            products (name, image_urls),
            product_variants (color, sku, size: sizes (size_name))
          ),
          user_addresses (addresses (*))
        `
        )
        .eq("user_id", userId);

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createOrder: async (req, res) => {
    try {
      const userId = req.user.id;
      const { user_address_id, payment_method, cart_id, voucher_code } =
        req.body;

      // Get cart items
      const { data: cartItems, error: cartError } = await supabase
        .from("cart_items")
        .select(
          `
          *,
          products (price: product_price_history (price, effective_date, end_date)),
          product_variants (additional_price)
        `
        )
        .eq("cart_id", cart_id);

      if (cartError) throw cartError;
      if (!cartItems.length)
        return res.status(400).json({ error: "Cart is empty" });

      // Calculate subtotal
      let subtotal = 0;
      const orderItems = cartItems.map((item) => {
        const price = item.products.price.find(
          (p) => !p.end_date || p.end_date > new Date()
        ).price;
        const total =
          (price + (item.product_variants.additional_price || 0)) *
          item.quantity;
        subtotal += total;
        return {
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: price,
          line_total: total,
        };
      });

      // Initialize order data
      let discount_amount = 0;
      let voucher_id = null;
      let total = subtotal;

      // Apply voucher if provided
      if (voucher_code) {
        const { data: voucher, error: voucherError } = await supabase
          .from("vouchers")
          .select("*")
          .eq("code", voucher_code)
          .eq("is_active", true)
          .gte("valid_to", new Date().toISOString())
          .single();

        if (voucherError) throw voucherError;
        if (!voucher)
          return res
            .status(404)
            .json({ error: "Voucher not found or expired" });

        // Verify user voucher assignment
        const { data: userVoucher, error: userVoucherError } = await supabase
          .from("user_vouchers")
          .select("id")
          .eq("voucher_id", voucher.id)
          .eq("user_id", userId)
          .eq("is_used", false)
          .single();

        if (userVoucherError) throw userVoucherError;
        if (!userVoucher)
          return res
            .status(400)
            .json({ error: "Voucher not assigned to user or already used" });

        // Check minimum order value
        if (voucher.min_order_value && subtotal < voucher.min_order_value) {
          return res
            .status(400)
            .json({
              error: `Order subtotal must be at least ${voucher.min_order_value}`,
            });
        }

        // Calculate discount
        if (voucher.type === "percentage") {
          discount_amount = (subtotal * voucher.value) / 100;
          if (voucher.max_discount_amount) {
            discount_amount = Math.min(
              discount_amount,
              voucher.max_discount_amount
            );
          }
        } else if (voucher.type === "fixed_amount") {
          discount_amount = voucher.value;
        } else if (voucher.type === "free_shipping") {
          discount_amount = order.shipping_fee || 0; // Assuming shipping_fee is calculated elsewhere
        }

        voucher_id = voucher.id;
        total = subtotal - discount_amount;

        // Mark user voucher as used
        await supabase
          .from("user_vouchers")
          .update({ is_used: true, used_at: new Date() })
          .eq("id", userVoucher.id);

        // Update voucher used count
        await supabase
          .from("vouchers")
          .update({ used_count: voucher.used_count + 1 })
          .eq("id", voucher.id);
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert([
          {
            user_id: userId,
            user_address_id,
            subtotal,
            discount_amount,
            total, // Add shipping_fee, tax_amount as needed
            voucher_id,
            payment_method,
            status: "pending",
            payment_status: "pending",
            order_number: `ORD-${Date.now()}`,
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order items
      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

      if (itemsError) throw itemsError;

      // Update cart status
      await supabase
        .from("carts")
        .update({ status: "converted" })
        .eq("id", cart_id);

      // Log audit action
      await supabase.from("audit_logs").insert([
        {
          table_name: "orders",
          record_id: order.id,
          action: "INSERT",
          new_values: order,
          user_id: userId,
          ip_address: req.ip,
          user_agent: req.get("User-Agent"),
        },
      ]);

      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getOrderById: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_items (
            *,
            products (name, image_urls),
            product_variants (color, sku, size: sizes (size_name))
          ),
          user_addresses (addresses (*))
        `
        )
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Order not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateOrderStatus: async (req, res) => {
    // Add role-based access control for admin
    try {
      const { id } = req.params;
      const { status, comment } = req.body;
      const changed_by = req.user.id;

      const { data, error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Order not found" });

      // Log status change
      await supabase
        .from("order_status_history")
        .insert([{ order_id: id, new_status: status, comment, changed_by }]);

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = orderController;
