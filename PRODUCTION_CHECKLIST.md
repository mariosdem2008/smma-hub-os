# SMMAHUB Production Launch Checklist

## 🚨 Critical: Pre-Launch Requirements

### 1. Add Stripe Webhook Secret
**Status:** ⚠️ REQUIRED - Blocking Production Launch

**Steps:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/) → Developers → Webhooks
2. Create new webhook endpoint: `https://dzyhrzdwwuaorruscxcn.supabase.co/functions/v1/stripe-webhook`
3. Subscribe to these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Click "Reveal signing secret" and copy the value
5. Add to Lovable Cloud:
   - Open project settings → Lovable Cloud → Secrets
   - Add new secret: `STRIPE_WEBHOOK_SECRET` with the copied value
6. Redeploy edge functions (automatic on next code change)

**Why this is critical:** Without this secret, subscription webhooks will fail silently. Users will pay but won't get access to paid features.

---

## ✅ Completed Pre-Launch Tasks

### Security
- ✅ All RLS policies configured and tested
- ✅ Sensitive data (tokens, emails) protected via SECURITY DEFINER functions
- ✅ Views use SECURITY INVOKER
- ✅ SQL functions use `SET search_path = public`
- ✅ No critical security scan errors
- ✅ Debug routes removed from production

### Authentication
- ✅ Agency auth (email/password) working
- ✅ Client portal auth (separate system) working
- ✅ Team invitations with role-based access working
- ✅ Client portal invitations working
- ✅ Password reset flows working (both systems)

### Core Features
- ✅ Project-based content pipeline (8 stages)
- ✅ Assets library with upload/organization
- ✅ Ideas module (Notion-like expandable pages)
- ✅ Scripts module (structured editor)
- ✅ Calendar with timezone conversion
- ✅ Client portal approvals workflow
- ✅ Task management system
- ✅ Team management with RBAC

### Integrations
- ✅ Stripe checkout (recurring subscriptions)
- ✅ Meta OAuth (Instagram + Facebook)
- ✅ Instagram autoposting
- ✅ Facebook autoposting
- ✅ Token refresh automation (12h cron)
- ✅ Scheduled publishing automation (5min cron)

### Billing & Plans
- ✅ Freemium, Starter, Pro, Agency Plus plans configured
- ✅ Plan limits enforced (clients, team, storage)
- ✅ Upgrade/downgrade flows working
- ✅ Customer portal integration
- ✅ Storage tracking and quotas

---

## 📋 Optional Improvements (Post-Launch)

### Email Notifications
- ⚠️ Failed autoposting alerts (currently console.warn only)
- Consider: Resend integration for transactional emails

### Security Enhancements
- ⚠️ Enable leaked password protection in Supabase Auth settings
- Consider: Rate limiting on auth endpoints

### Monitoring
- ✅ Post logs table (tracking all autopost attempts)
- ✅ Token refresh logs (tracking Meta token refreshes)
- ✅ Project failure tracking (3-failure alerting)
- Consider: Sentry for error tracking
- Consider: Analytics integration

---

## 🧪 Final Testing Protocol

### End-to-End User Journeys

#### 1. New Agency User Flow
- [ ] Visit landing page → Join waitlist (verify DB insert)
- [ ] Sign up → Onboarding (3 steps) → Create first client
- [ ] Connect Meta OAuth (Instagram + Facebook)
- [ ] Create project → Upload assets → Schedule post
- [ ] Verify autoposting at scheduled time
- [ ] Verify published URLs saved to project

#### 2. Subscription Flow
- [ ] Free user → View pricing → Upgrade to Starter
- [ ] Complete Stripe checkout
- [ ] Verify subscription activated (check `subscriptions` table)
- [ ] Create 3rd client (should succeed on Starter)
- [ ] Try to create 4th client (should show paywall)
- [ ] Upgrade to Pro → Verify limits increased

#### 3. Client Portal Flow
- [ ] Agency creates client → Enable portal → Send invite
- [ ] Client receives email → Sign up via invite
- [ ] Verify email (Supabase Auth) → Login
- [ ] View scheduled content on calendar
- [ ] Review project in "Client Review" stage
- [ ] Approve project → Verify moves to "Approved" stage
- [ ] Request changes → Verify moves back to "Production/Editing"

#### 4. Team Collaboration Flow
- [ ] Owner invites Manager → Manager accepts
- [ ] Manager creates client and project
- [ ] Manager schedules post → Verify autopublishes
- [ ] Owner invites Editor → Editor accepts
- [ ] Verify Editor can create but not delete clients
- [ ] Owner upgrades to Agency Plus
- [ ] Owner promotes Manager to Admin
- [ ] Verify multi-admin permissions working

---

## 🚀 Production Deployment Checklist

### Pre-Deploy
- [x] Remove debug routes from production code
- [ ] Add `STRIPE_WEBHOOK_SECRET` to Lovable Cloud
- [ ] Configure Stripe webhook endpoint
- [ ] Test all cron jobs running (check Supabase Functions logs)
- [ ] Verify Meta app is in Live mode (not Development)
- [ ] Test OAuth redirects on production domain

### Deploy
- [ ] Click "Publish" in Lovable
- [ ] Wait for build to complete
- [ ] Verify all edge functions deployed (20 total)
- [ ] Test landing page loads
- [ ] Test signup flow works

### Post-Deploy Verification
- [ ] Create test account and complete onboarding
- [ ] Test Stripe checkout on production
- [ ] Test Meta OAuth connection on production
- [ ] Schedule test post for immediate publish (1 min from now)
- [ ] Verify post publishes to Instagram/Facebook
- [ ] Check `post_logs` table for success
- [ ] Monitor error logs for 24 hours

### Optional Production Optimizations
- [ ] Set up custom domain (if not already)
- [ ] Configure CDN for static assets
- [ ] Enable database connection pooling (if high traffic)
- [ ] Set up database backups schedule
- [ ] Configure alerts for failed posts (email/Slack)

---

## 📞 Support & Monitoring

### Key Metrics to Monitor
- Signup conversion rate
- Stripe checkout completion rate
- Autopublish success rate (check `post_logs`)
- Token refresh success rate (check `token_refresh_logs`)
- Storage usage per plan tier
- Failed project alerts (check `project_failure_tracking`)

### Troubleshooting Resources
- **Logs Tab:** Settings → Logs (post attempts, token refreshes, failures)
- **Supabase Logs:** Lovable Cloud → Functions → View logs
- **Stripe Dashboard:** Payments, subscriptions, webhooks
- **Meta Events Manager:** Failed API calls, rate limits

---

## 🎯 Launch Status

**Current Status:** 🟡 90% Ready - Awaiting Stripe Webhook Secret

**Next Steps:**
1. Add `STRIPE_WEBHOOK_SECRET` to Lovable Cloud (5 min)
2. Configure Stripe webhook endpoint (5 min)
3. Run final testing protocol (1-2 hours)
4. Deploy to production 🚀

**Estimated Time to Launch:** 2-3 hours
