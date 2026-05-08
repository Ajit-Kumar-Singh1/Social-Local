import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import pagesRouter from "./pages.js";
import postsRouter from "./posts.js";
import imagesRouter from "./images.js";
import dashboardRouter from "./dashboard.js";
import uploadsRouter from "./uploads.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(pagesRouter);
router.use(postsRouter);
router.use(imagesRouter);
router.use(dashboardRouter);
router.use(uploadsRouter);

export default router;
