const orderService = require('../services/orderService');
const { sendSuccess, sendError, sendNotFound } = require('../../../utilities/responseUtil');
const logger = require('../../../utilities/loggingUtil');

const MODULE = 'OrderController';

/**
 * POST /api/orders/place
 * Public COD checkout entry point for the Phase 1 webapp.
 */
async function placeOrder(req, res) {
  try {
    const result = await orderService.placeOrder(req.body);
    return sendSuccess(
      res,
      'Order placed successfully. Payment will be collected on delivery.',
      result,
      201
    );
  } catch (err) {
    logger.error(MODULE, 'PLACE_ORDER_ERROR', { error: err.message });
    const allowedErrors = [
      'Merchant not found', 
      'One or more products are unavailable',
      'Cash on Delivery (COD) is currently disabled by the platform.'
    ];
    const message = allowedErrors.some(m => err.message.includes(m))
      ? err.message
      : 'Failed to place order. Please try again.';
    return sendError(res, message, message === err.message ? 400 : 500);

  }
}

/**
 * GET /api/orders
 * Admin can inspect all masterbrand orders; merchants only see their own.
 */
async function getOrders(req, res) {
  try {
    const limit = Number(req.query.limit || 10);
    const page = Number(req.query.page || 1);
    const offset = (page - 1) * limit;

    const result = await orderService.getOrders(req.selloUser, {
      merchantId: req.query.merchant_id ? Number(req.query.merchant_id) : null,
      status: req.query.status || '',
      search: req.query.search || '',
      date: req.query.date || '',
      limit,
      page
    });

    return sendSuccess(res, 'Orders fetched', result);
  } catch (err) {
    logger.error(MODULE, 'GET_ORDERS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch orders', 500);
  }
}

/**
 * GET /api/orders/:id
 * Detailed order snapshot with item rows.
 */
async function getOrderById(req, res) {
  try {
    const order = await orderService.getOrderById(Number(req.params.id), req.selloUser);
    if (!order) {
      return sendNotFound(res, 'Order not found');
    }

    return sendSuccess(res, 'Order fetched', { order });
  } catch (err) {
    logger.error(MODULE, 'GET_ORDER_BY_ID_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch order', 500);
  }
}

/**
 * PUT /api/orders/:id/status
 * Shared status transition endpoint for admin and merchant dashboards.
 */
async function updateOrderStatus(req, res) {
  try {
    const updated = await orderService.updateOrderStatus(
      Number(req.params.id),
      req.selloUser,
      req.body.status
    );

    if (!updated) {
      return sendNotFound(res, 'Order not found');
    }

    return sendSuccess(res, `Order status updated to "${req.body.status}"`);
  } catch (err) {
    logger.error(MODULE, 'UPDATE_STATUS_ERROR', { error: err.message });
    return sendError(res, 'Failed to update order status', 500);
  }
}

/**
 * GET /api/orders/stats
 * Revenue and order health cards for the dashboard.
 */
async function getOrderStats(req, res) {
  try {
    const stats = await orderService.getOrderStats(
      req.selloUser,
      req.query.merchant_id ? Number(req.query.merchant_id) : null
    );

    return sendSuccess(res, 'Stats fetched', { stats });
  } catch (err) {
    logger.error(MODULE, 'GET_STATS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch stats', 500);
  }
}
/**
 * GET /api/orders/analytics
 * Comprehensive order and merchant analytics for the dashboard.
 */
async function getOrderAnalytics(req, res) {
  try {
    const timeframe = req.query.timeframe || 'monthly';
    const analytics = await orderService.getOrderAnalytics(req.selloUser, timeframe);
    return sendSuccess(res, 'Analytics fetched', { analytics });
  } catch (err) {
    logger.error(MODULE, 'GET_ANALYTICS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch analytics', 500);
  }
}

async function deleteOrders(req, res) {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) {
      return sendError(res, 'No order IDs provided', 400);
    }

    const deleted = await orderService.deleteOrders(ids, req.selloUser);
    return sendSuccess(res, `${deleted} orders deleted successfully`);
  } catch (err) {
    logger.error(MODULE, 'DELETE_ORDERS_ERROR', { error: err.message });
    return sendError(res, 'Failed to delete orders', 500);
  }
}

async function getCustomerOrders(req, res) {
  try {
    const orders = await orderService.getCustomerOrders(req.selloUser.id);
    return sendSuccess(res, 'Orders fetched', { orders });
  } catch (err) {
    logger.error(MODULE, 'GET_CUSTOMER_ORDERS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch your orders', 500);
  }
}

async function cancelOrder(req, res) {
  try {
    const success = await orderService.cancelOrder(Number(req.params.id), req.selloUser.id);
    if (!success) {
      return sendError(res, 'Could not cancel order. It might already be in process or cancelled.', 400);
    }
    return sendSuccess(res, 'Order cancelled successfully');
  } catch (err) {
    logger.error(MODULE, 'CANCEL_ORDER_ERROR', { error: err.message });
    return sendError(res, 'Failed to cancel order', 500);
  }
}

async function getBillBreakdown(req, res) {
  try {
    const result = await orderService.getBillBreakdown(req.body);
    return sendSuccess(res, 'Bill breakdown calculated', result);
  } catch (err) {
    logger.error(MODULE, 'BILL_BREAKDOWN_ERROR', { error: err.message });
    return sendError(res, err.message, 400);
  }
}

module.exports = { 
  placeOrder, getOrders, getOrderById, updateOrderStatus, getOrderStats, getOrderAnalytics, deleteOrders,
  getCustomerOrders, cancelOrder, getBillBreakdown
};

