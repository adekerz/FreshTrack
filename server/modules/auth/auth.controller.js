/**
 * Auth Controller (combiner)
 *
 * Aggregates all auth sub-controllers into a single router.
 * Mounted at /api/auth in server/index.js via auth/index.js.
 */

import { Router } from 'express'
import coreRouter from './auth-core.controller.js'
import usersRouter from './auth-users.controller.js'
import mfaRouter from './auth-mfa.controller.js'
import emailRouter from './auth-email.controller.js'
import accountRouter from './auth-account.controller.js'

const router = Router()

router.use('/', coreRouter)
router.use('/', usersRouter)
router.use('/', mfaRouter)
router.use('/', emailRouter)
router.use('/', accountRouter)

export default router
