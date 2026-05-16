const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../../../utilities/responseUtil');
const logger = require('../../../utilities/loggingUtil');

const MODULE = 'AuthController';

/**
 * Shared login helper keeps both login endpoints aligned while still allowing role-specific URLs.
 */
async function loginByRole(req, res, allowedRoles, eventName) {
  const { email, password } = req.body;

  const user = await authService.findUserByEmail(email);
  if (!user || !allowedRoles.includes(user.role)) {
    return sendError(res, 'Invalid email or password', 401);
  }

  const valid = await authService.verifyPassword(password, user.password_hash);
  if (!valid) {
    return sendError(res, 'Invalid email or password', 401);
  }

  const session = await authService.buildTokenForUser(user);
  logger.info(MODULE, eventName, { userId: user.id, email, role: user.role });
  return sendSuccess(res, 'Login successful', session);
}

/**
 * POST /api/auth/admin/login
 * Masterbrand admin login for the dashboard.
 */
async function adminLogin(req, res) {
  try {
    return await loginByRole(req, res, ['SUPER_ADMIN', 'MASTERBRAND_ADMIN'], 'ADMIN_LOGIN_SUCCESS');
  } catch (err) {
    logger.error(MODULE, 'ADMIN_LOGIN_ERROR', { error: err.message });
    return sendError(res, 'Login failed. Please try again.', 500);
  }
}

/**
 * POST /api/auth/merchant/login
 * Merchant admin login for inherited catalogue and order management.
 */
async function merchantLogin(req, res) {
  try {
    return await loginByRole(req, res, ['MERCHANT_ADMIN'], 'MERCHANT_LOGIN_SUCCESS');
  } catch (err) {
    logger.error(MODULE, 'MERCHANT_LOGIN_ERROR', { error: err.message });
    return sendError(res, 'Login failed. Please try again.', 500);
  }
}

/**
 * POST /api/auth/admin/signup
 * Allows a new Masterbrand Admin to register, creating a fresh masterbrand scope.
 */
async function adminSignup(req, res) {
  try {
    const { name, email, password, phone, masterbrand_name } = req.body;
    
    if (!name || !email || !password || !masterbrand_name) {
      return sendError(res, 'Please provide all required fields: name, email, password, and masterbrand name', 400);
    }
    if (password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters long', 400);
    }

    const existing = await authService.findUserByEmail(email);
    if (existing) {
      return sendError(res, 'An account with this email already exists');
    }

    const created = await authService.createAdminAccount({
      name,
      email,
      password,
      phone,
      masterbrand_name
    });

    const session = await authService.buildTokenForUser({ id: created.userId });
    return sendSuccess(res, 'Admin account created successfully', session, 201);
  } catch (err) {
    logger.error(MODULE, 'ADMIN_SIGNUP_ERROR', { error: err.message });
    return sendError(res, 'Signup failed. Please try again.', 500);
  }
}

/**
 * POST /api/auth/merchant/signup
 * Optional self-serve merchant onboarding for the mini project.
 */
async function merchantSignup(req, res) {
  try {
    const { owner_name, merchant_name, email, password, phone, address, masterbrand_id } = req.body;

    if (!owner_name || !merchant_name || !email || !password) {
      return sendError(res, 'Please provide all required fields: owner name, merchant name, email, and password', 400);
    }
    if (password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters long', 400);
    }

    const existing = await authService.findUserByEmail(email);
    if (existing) {
      return sendError(res, 'An account with this email already exists');
    }

    const created = await authService.createMerchantAccount({
      owner_name,
      merchant_name,
      email,
      password,
      phone,
      address,
      masterbrand_id
    });

    const session = await authService.buildTokenForUser({ id: created.userId });

    logger.info(MODULE, 'MERCHANT_SIGNUP_SUCCESS', {
      userId: created.userId,
      merchantId: created.merchantId,
      email
    });

    return sendSuccess(res, 'Merchant account created successfully', session, 201);
  } catch (err) {
    logger.error(MODULE, 'MERCHANT_SIGNUP_ERROR', { error: err.message });
    if (err.code === 'ER_DUP_ENTRY') {
      return sendError(res, 'An account with this email already exists');
    }
    return sendError(res, 'Signup failed. Please try again.', 500);
  }
}

/**
 * GET /api/auth/profile
 * Hydrates the dashboard with fresh user and merchant scope information.
 */
async function getProfile(req, res) {
  try {
    const profile = await authService.getUserProfile(req.selloUser.id);
    if (!profile) {
      return sendError(res, 'Profile not found', 404);
    }

    return sendSuccess(res, 'Profile fetched', { profile });
  } catch (err) {
    logger.error(MODULE, 'GET_PROFILE_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch profile', 500);
  }
}

async function updateProfile(req, res) {
  try {
    const { name, email, phone } = req.body;
    await authService.updateUserProfile(req.selloUser.id, { name, email, phone });
    return sendSuccess(res, 'Profile updated successfully');
  } catch (err) {
    logger.error(MODULE, 'UPDATE_PROFILE_ERROR', { error: err.message });
    return sendError(res, 'Failed to update profile', 500);
  }
}

async function customerLogin(req, res) {
  try {
    return await loginByRole(req, res, ['CUSTOMER'], 'CUSTOMER_LOGIN_SUCCESS');
  } catch (err) {
    logger.error(MODULE, 'CUSTOMER_LOGIN_ERROR', { error: err.message });
    return sendError(res, 'Login failed', 500);
  }
}

async function customerSignup(req, res) {
  try {
    const { name, email, password, phone } = req.body;
    const existing = await authService.findUserByEmail(email);
    if (existing) {
      return sendError(res, 'Email already registered');
    }

    const created = await authService.createCustomerAccount({ name, email, password, phone });
    const session = await authService.buildTokenForUser({ id: created.userId });
    return sendSuccess(res, 'Account created', session, 201);
  } catch (err) {
    logger.error(MODULE, 'CUSTOMER_SIGNUP_ERROR', { error: err.message });
    return sendError(res, 'Signup failed', 500);
  }
}

async function getCustomers(req, res) {
  try {
    const { search, date } = req.query;
    const customers = await authService.getCustomers(req.selloUser, { search, date });
    return sendSuccess(res, 'Customers fetched', { customers });
  } catch (err) {
    logger.error(MODULE, 'GET_CUSTOMERS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch customers', 500);
  }
}

async function updateCustomer(req, res) {
  try {
    await authService.updateCustomer(req.params.id, req.body);
    return sendSuccess(res, 'Customer updated successfully');
  } catch (err) {
    logger.error(MODULE, 'UPDATE_CUSTOMER_ERROR', { error: err.message });
    return sendError(res, 'Failed to update customer', 500);
  }
}

async function deleteCustomer(req, res) {
  try {
    await authService.deleteCustomer(req.params.id);
    return sendSuccess(res, 'Customer deleted successfully');
  } catch (err) {
    logger.error(MODULE, 'DELETE_CUSTOMER_ERROR', { error: err.message });
    return sendError(res, 'Failed to delete customer', 500);
  }
}

async function getMasterbrands(req, res) {
  try {
    const masterbrands = await authService.getMasterbrands();
    return sendSuccess(res, 'Masterbrands fetched', { masterbrands });
  } catch (err) {
    logger.error(MODULE, 'GET_MASTERBRANDS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch masterbrands', 500);
  }
}

module.exports = { 
  adminLogin, merchantLogin, merchantSignup, adminSignup, 
  getProfile, updateProfile, 
  customerLogin, customerSignup, getCustomers, updateCustomer, deleteCustomer,
  getMasterbrands
};
