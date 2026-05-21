const merchantService                          = require('../services/merchantService');
const { sendSuccess, sendError, sendNotFound } = require('../../../utilities/responseUtil');
const { trackError }                           = require('../../../utilities/errorTracker');
const logger                                   = require('../../../utilities/loggingUtil');

const MODULE = 'MerchantController';

// ─── Merchant List / Overview ─────────────────────────────────────────────────

/**
 * GET /api/merchants
 * Admin merchant list with derived catalogue/order stats.
 */
async function getAllMerchants(req, res) {
  try {
    const limit  = Number(req.query.limit || 10);
    const page   = Number(req.query.page  || 1);
    const offset = (page - 1) * limit;

    const result = await merchantService.getAllMerchants(req.selloUser.masterbrandId, {
      search: req.query.search || '',
      status: req.query.status || 'all',
      limit,
      offset
    });
    return sendSuccess(res, 'Merchants fetched', result);
  } catch (err) {
    logger.error(MODULE, 'GET_ALL_MERCHANTS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch merchants', 500);
  }
}

/**
 * GET /api/merchants/overview
 * Single endpoint for dashboard landing page.
 */
async function getOverview(req, res) {
  try {
    const overview = await merchantService.getOverview(req.selloUser);
    return sendSuccess(res, 'Overview fetched', { overview });
  } catch (err) {
    logger.error(MODULE, 'GET_OVERVIEW_ERROR', { error: err.message });
    await trackError(err, req);
    return sendError(res, 'Failed to fetch overview', 500);
  }
}

// ─── Merchant Profile ─────────────────────────────────────────────────────────

/**
 * GET /api/merchants/profile  |  GET /api/merchants/:id
 * Merchant self-profile or admin-scoped merchant lookup.
 */
async function getMerchantProfile(req, res) {
  try {
    const merchantId = req.selloUser.merchantId || Number(req.params.id);

    if (isNaN(merchantId)) {
      return sendError(res, 'Valid Merchant ID is required', 400);
    }

    const merchant = await merchantService.getMerchantById(merchantId, req.selloUser.masterbrandId);

    if (!merchant) {
      return sendNotFound(res, 'Merchant not found');
    }

    return sendSuccess(res, 'Merchant profile fetched', { merchant });
  } catch (err) {
    logger.error(MODULE, 'GET_MERCHANT_PROFILE_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch profile', 500);
  }
}

/**
 * PUT /api/merchants/profile
 * Store-level metadata updates are limited to the owning merchant account.
 */
async function updateMerchantProfile(req, res) {
  try {
    if (!req.selloUser.merchantId) {
      return sendError(res, 'Only merchant users can update this profile');
    }

    await merchantService.updateMerchantProfile(
      req.selloUser.merchantId,
      req.selloUser.masterbrandId,
      req.body
    );

    const merchant = await merchantService.getMerchantById(
      req.selloUser.merchantId,
      req.selloUser.masterbrandId
    );

    return sendSuccess(res, 'Profile updated successfully', { merchant });
  } catch (err) {
    logger.error(MODULE, 'UPDATE_MERCHANT_PROFILE_ERROR', { error: err.message });
    return sendError(res, 'Failed to update profile', 500);
  }
}

// ─── Merchant CRUD (admin) ────────────────────────────────────────────────────

async function createMerchant(req, res) {
  try {
    const result = await merchantService.createMerchant(req.selloUser.masterbrandId, req.body);
    return sendSuccess(res, 'Merchant created successfully', result, 201);
  } catch (err) {
    logger.error(MODULE, 'CREATE_MERCHANT_ERROR', { error: err.message });
    return sendError(res, 'Failed to create merchant', 500);
  }
}

/**
 * PUT /api/merchants/:id/status
 * Masterbrand admin can activate/deactivate a merchant and its users.
 */
async function toggleMerchantStatus(req, res) {
  try {
    const merchantId  = Number(req.params.id);
    const { is_active } = req.body;

    await merchantService.toggleMerchantStatus(merchantId, req.selloUser.masterbrandId, is_active);
    return sendSuccess(res, `Merchant ${is_active ? 'activated' : 'deactivated'} successfully`);
  } catch (err) {
    logger.error(MODULE, 'TOGGLE_STATUS_ERROR', { error: err.message });
    return sendError(res, 'Failed to update merchant status', 500);
  }
}

async function deleteMerchant(req, res) {
  try {
    const merchantId = Number(req.params.id);
    await merchantService.deleteMerchant(merchantId, req.selloUser.masterbrandId);
    return sendSuccess(res, 'Merchant deleted successfully');
  } catch (err) {
    logger.error(MODULE, 'DELETE_MERCHANT_ERROR', { error: err.message });
    return sendError(res, err.message || 'Failed to delete merchant', 500);
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * GET /api/merchants/notifications
 * Feed backing the dashboard notification card and snooze actions.
 */
async function getNotifications(req, res) {
  try {
    const notifications = await merchantService.getNotifications(req.selloUser, {
      limit: Number(req.query.limit || 10)
    });
    return sendSuccess(res, 'Notifications fetched', { notifications });
  } catch (err) {
    logger.error(MODULE, 'GET_NOTIFICATIONS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch notifications', 500);
  }
}

/**
 * PUT /api/merchants/notifications/:id/snooze
 * Snooze window is stored as a concrete datetime for easy SQL filtering.
 */
async function snoozeNotification(req, res) {
  try {
    const hours      = Number(req.body.hours || 1);
    const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    const updated    = await merchantService.snoozeNotification(
      req.selloUser,
      Number(req.params.id),
      snoozeUntil
    );

    if (!updated) {
      return sendNotFound(res, 'Notification not found');
    }

    return sendSuccess(res, 'Notification snoozed successfully');
  } catch (err) {
    logger.error(MODULE, 'SNOOZE_NOTIFICATION_ERROR', { error: err.message });
    return sendError(res, 'Failed to snooze notification', 500);
  }
}

async function markNotificationRead(req, res) {
  try {
    const updated = await merchantService.markNotificationRead(req.selloUser, Number(req.params.id));
    if (!updated) {
      return sendNotFound(res, 'Notification not found');
    }

    return sendSuccess(res, 'Notification marked as read');
  } catch (err) {
    logger.error(MODULE, 'READ_NOTIFICATION_ERROR', { error: err.message });
    return sendError(res, 'Failed to update notification', 500);
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

async function getSettings(req, res) {
  try {
    const settings = await merchantService.getMasterbrandSettings(req.selloUser.masterbrandId);
    return sendSuccess(res, 'Settings fetched', { settings });
  } catch (err) {
    logger.error(MODULE, 'GET_SETTINGS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch settings', 500);
  }
}

async function updateSettings(req, res) {
  try {
    await merchantService.updateMasterbrandSettings(req.selloUser.masterbrandId, req.body);
    return sendSuccess(res, 'Settings updated successfully');
  } catch (err) {
    logger.error(MODULE, 'UPDATE_SETTINGS_ERROR', { error: err.message });
    return sendError(res, 'Failed to update settings', 500);
  }
}

async function toggleMerchantSponsored(req, res) {
  try {
    const merchantId = Number(req.params.id);
    const { is_sponsored } = req.body;

    await merchantService.toggleMerchantSponsored(merchantId, req.selloUser.masterbrandId, is_sponsored);
    return sendSuccess(res, `Merchant ${is_sponsored ? 'sponsored status enabled' : 'sponsored status disabled'} successfully`);
  } catch (err) {
    logger.error(MODULE, 'TOGGLE_SPONSORED_ERROR', { error: err.message });
    return sendError(res, 'Failed to update merchant sponsored status', 500);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getAllMerchants,
  getOverview,
  getMerchantProfile,
  updateMerchantProfile,
  createMerchant,
  toggleMerchantStatus,
  toggleMerchantSponsored,
  deleteMerchant,
  getNotifications,
  snoozeNotification,
  markNotificationRead,
  getSettings,
  updateSettings
};
