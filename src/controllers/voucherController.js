const supabase = require("../config/supabase");
const { validationResult } = require("express-validator");

const voucherController = {
  getUserVouchers: async (req, res) => {
    try {
      const userId = req.user.id;
      const { data, error } = await supabase
        .from("user_vouchers")
        .select(
          `
          id,
          is_used,
          vouchers (*)
        `
        )
        .eq("user_id", userId);

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getVouchers: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("is_active", true)
        .gte("valid_to", new Date().toISOString());

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getVoucherById: async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Voucher not found" });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  assignVoucher: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { user_id } = req.body;

      // Verify voucher exists
      const { data: voucher, error: voucherError } = await supabase
        .from("vouchers")
        .select("*")
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (voucherError) throw voucherError;
      if (!voucher) return res.status(404).json({ error: "Voucher not found" });

      // Check usage limit per user
      const { count, error: countError } = await supabase
        .from("user_vouchers")
        .select("id", { count: "exact" })
        .eq("voucher_id", id)
        .eq("user_id", user_id);

      if (countError) throw countError;
      if (
        voucher.usage_limit_per_user &&
        count >= voucher.usage_limit_per_user
      ) {
        return res
          .status(400)
          .json({ error: "User has reached voucher usage limit" });
      }

      // Check total usage limit
      if (voucher.usage_limit && voucher.used_count >= voucher.usage_limit) {
        return res
          .status(400)
          .json({ error: "Voucher has reached total usage limit" });
      }

      // Assign voucher to user
      const { data, error } = await supabase
        .from("user_vouchers")
        .insert([{ voucher_id: id, user_id, assigned_at: new Date() }])
        .select()
        .single();

      if (error) throw error;

      // Create notification for user
      const { data: notificationType, error: typeError } = await supabase
        .from("notification_types")
        .select("id")
        .eq("type_name", "voucher_assigned")
        .single();

      if (typeError && typeError.code !== "PGRST116") throw typeError;

      let typeId = notificationType?.id;
      if (!typeId) {
        const { data: newType, error: newTypeError } = await supabase
          .from("notification_types")
          .insert([
            {
              type_name: "voucher_assigned",
              display_name: "New Voucher Assigned",
              is_active: true,
            },
          ])
          .select()
          .single();
        if (newTypeError) throw newTypeError;
        typeId = newType.id;
      }

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert([
          {
            type_id: typeId,
            title: `New Voucher: ${voucher.name}`,
            content: `You have been assigned a new voucher: ${voucher.code}. Valid until ${voucher.valid_to}.`,
            target_type: "user",
            target_value: user_id,
            created_by: req.user.id,
          },
        ]);

      if (notificationError) throw notificationError;

      const { error: userNotificationError } = await supabase
        .from("user_notifications")
        .insert([
          {
            notification_id: supabase
              .from("notifications")
              .select("id")
              .order("created_at", { ascending: false })
              .limit(1),
            user_id,
          },
        ]);

      if (userNotificationError) throw userNotificationError;

      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  applyVoucher: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.id;
      const { voucher_code, order_id } = req.body;

      // Verify order belongs to user
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, subtotal, voucher_id, status")
        .eq("id", order_id)
        .eq("user_id", userId)
        .single();

      if (orderError) throw orderError;
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.voucher_id)
        return res
          .status(400)
          .json({ error: "Order already has a voucher applied" });
      if (order.status !== "pending")
        return res
          .status(400)
          .json({ error: "Voucher can only be applied to pending orders" });

      // Verify voucher
      const { data: voucher, error: voucherError } = await supabase
        .from("vouchers")
        .select("*")
        .eq("code", voucher_code)
        .eq("is_active", true)
        .gte("valid_to", new Date().toISOString())
        .single();

      if (voucherError) throw voucherError;
      if (!voucher)
        return res.status(404).json({ error: "Voucher not found or expired" });

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
      if (voucher.min_order_value && order.subtotal < voucher.min_order_value) {
        return res.status(400).json({
          error: `Order subtotal must be at least ${voucher.min_order_value}`,
        });
      }

      // Calculate discount
      let discount_amount = 0;
      if (voucher.type === "percentage") {
        discount_amount = (order.subtotal * voucher.value) / 100;
        if (voucher.max_discount_amount) {
          discount_amount = Math.min(
            discount_amount,
            voucher.max_discount_amount
          );
        }
      } else if (voucher.type === "fixed_amount") {
        discount_amount = voucher.value;
      } else if (voucher.type === "free_shipping") {
        discount_amount = order.shipping_fee || 0;
      }

      // Update order with voucher
      const { data: updatedOrder, error: updateError } = await supabase
        .from("orders")
        .update({
          voucher_id: voucher.id,
          discount_amount,
          total:
            order.subtotal +
            (order.shipping_fee || 0) +
            (order.tax_amount || 0) -
            discount_amount,
          updated_at: new Date(),
        })
        .eq("id", order_id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Mark user voucher as used
      const { error: userVoucherUpdateError } = await supabase
        .from("user_vouchers")
        .update({ is_used: true, used_at: new Date() })
        .eq("id", userVoucher.id);

      if (userVoucherUpdateError) throw userVoucherUpdateError;

      // Update voucher used count
      const { error: voucherUpdateError } = await supabase
        .from("vouchers")
        .update({ used_count: voucher.used_count + 1 })
        .eq("id", voucher.id);

      if (voucherUpdateError) throw voucherUpdateError;

      // Log audit action
      await supabase.from("audit_logs").insert([
        {
          table_name: "orders",
          record_id: order_id,
          action: "UPDATE",
          old_values: {
            voucher_id: order.voucher_id,
            discount_amount: order.discount_amount,
            total: order.total,
          },
          new_values: {
            voucher_id: voucher.id,
            discount_amount,
            total: updatedOrder.total,
          },
          user_id: userId,
          ip_address: req.ip,
          user_agent: req.get("User-Agent"),
        },
      ]);

      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = voucherController;
