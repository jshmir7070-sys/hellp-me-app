import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const adminDistPath = path.resolve(process.cwd(), "admin", "dist");
  
  if (fs.existsSync(adminDistPath)) {
    console.log(`[Static] Serving admin from: ${adminDistPath}`);
    
    // Serve static assets from admin dist
    app.use("/admin/assets", express.static(path.join(adminDistPath, "assets"), {
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }));
    
    // SPA fallback for all admin routes
    app.use("/admin", (_req, res, next) => {
      // Skip if requesting a file with extension (except .html)
      const ext = path.extname(_req.path).toLowerCase();
      if (ext && ext !== '.html') {
        return next();
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(path.resolve(adminDistPath, "index.html"));
    });
  } else {
    console.log(`[Static] Admin dist not found at: ${adminDistPath}`);
  }

  const isDeployment = process.env.REPLIT_DEPLOYMENT === '1';
  const distPath = isDeployment 
    ? path.resolve(process.cwd(), "dist", "public")
    : path.resolve(__dirname, "public");
  
  const templatesPath = path.resolve(__dirname, "templates");
  
  if (fs.existsSync(distPath)) {
    console.log(`[Static] Serving files from: ${distPath}`);

    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        const basename = path.basename(filePath).toLowerCase();
        
        if (ext === '.html' || basename === 'sw.js' || basename === 'manifest.json') {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
      }
    }));

    // 개인정보처리방침/이용약관 페이지 (SPA 폴백보다 우선)
    app.get("/privacy", (_req, res) => {
      const privacyPage = path.resolve(templatesPath, "privacy-policy.html");
      if (fs.existsSync(privacyPage)) {
        res.sendFile(privacyPage);
      } else {
        res.status(404).json({ message: "Privacy policy page not found" });
      }
    });

    app.get("/terms", (_req, res) => {
      const termsPage = path.resolve(templatesPath, "terms-of-service.html");
      if (fs.existsSync(termsPage)) {
        res.sendFile(termsPage);
      } else {
        res.status(404).json({ message: "Terms of service page not found" });
      }
    });

    app.use("*", (_req, res, next) => {
      if (_req.originalUrl.startsWith('/api') || _req.originalUrl.startsWith('/admin')) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else if (fs.existsSync(templatesPath)) {
    console.log(`[Static] Serving landing page from: ${templatesPath}`);
    app.use(express.static(templatesPath));
    
    app.get("/", (_req, res) => {
      const landingPage = path.resolve(templatesPath, "landing-page.html");
      if (fs.existsSync(landingPage)) {
        res.sendFile(landingPage);
      } else {
        res.json({ status: "ok", message: "API Server Running - Use Expo Go to access the mobile app" });
      }
    });

    app.get("/identity-verification", (_req, res) => {
      const verificationPage = path.resolve(templatesPath, "identity-verification.html");
      if (fs.existsSync(verificationPage)) {
        res.sendFile(verificationPage);
      } else {
        res.status(404).json({ message: "Identity verification page not found" });
      }
    });

    app.get("/payment/checkout", (_req, res) => {
      const checkoutPage = path.resolve(templatesPath, "payment-checkout.html");
      if (fs.existsSync(checkoutPage)) {
        res.sendFile(checkoutPage);
      } else {
        res.status(404).json({ message: "Payment checkout page not found" });
      }
    });

    app.get("/privacy", (_req, res) => {
      const privacyPage = path.resolve(templatesPath, "privacy-policy.html");
      if (fs.existsSync(privacyPage)) {
        res.sendFile(privacyPage);
      } else {
        res.status(404).json({ message: "Privacy policy page not found" });
      }
    });

    app.get("/terms", (_req, res) => {
      const termsPage = path.resolve(templatesPath, "terms-of-service.html");
      if (fs.existsSync(termsPage)) {
        res.sendFile(termsPage);
      } else {
        res.status(404).json({ message: "Terms of service page not found" });
      }
    });

    app.get("/payment/test-checkout", (_req, res) => {
      const checkoutPage = path.resolve(templatesPath, "payment-checkout.html");
      if (fs.existsSync(checkoutPage)) {
        res.sendFile(checkoutPage);
      } else {
        res.status(404).json({ message: "Payment checkout page not found" });
      }
    });
  } else {
    console.log(`[Static] No static files found, serving API only`);
    app.get("/", (_req, res) => {
      res.json({ status: "ok", message: "API Server Running - Use Expo Go to access the mobile app" });
    });
  }
}
