const notificationService                      = require('../services/notificationService');
const { sendSuccess, sendError }               = require('../../../utilities/responseUtil');
const logger                                   = require('../../../utilities/loggingUtil');

const MODULE = 'NotificationController';

// ─── History ──────────────────────────────────────────────────────────────────

async function getHistory(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { rows, total }          = await notificationService.getHistory(req.selloUser, {
      page:  parseInt(page),
      limit: parseInt(limit)
    });

    return sendSuccess(res, 'History fetched', { data: rows, total });
  } catch (err) {
    logger.error(MODULE, 'GET_HISTORY_ERROR', { error: err.message });
    next(err);
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

async function getTemplates(req, res, next) {
  try {
    const templates = await notificationService.getTemplates(req.selloUser);
    return sendSuccess(res, 'Templates fetched', { data: templates });
  } catch (err) {
    logger.error(MODULE, 'GET_TEMPLATES_ERROR', { error: err.message });
    next(err);
  }
}

async function createTemplate(req, res, next) {
  try {
    const { event_type, title_template, body_template } = req.body;
    await notificationService.createTemplate(req.selloUser, { event_type, title_template, body_template });
    return sendSuccess(res, 'Template created', {}, 201);
  } catch (err) {
    logger.error(MODULE, 'CREATE_TEMPLATE_ERROR', { error: err.message });
    next(err);
  }
}

async function updateTemplate(req, res, next) {
  try {
    const { title_template, body_template, is_active } = req.body;
    await notificationService.updateTemplate(Number(req.params.id), { title_template, body_template, is_active });
    return sendSuccess(res, 'Template updated');
  } catch (err) {
    logger.error(MODULE, 'UPDATE_TEMPLATE_ERROR', { error: err.message });
    next(err);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { getHistory, getTemplates, createTemplate, updateTemplate };
