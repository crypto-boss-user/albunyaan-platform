# Member Comms — Cutover Email (DRAFT, NOT APPROVED)

**⚠️ Status: draft only. Founder must review and approve the actual copy before
this goes anywhere near the ~600-member list.** This is a starting point, not
final copy — tone, exact wording, and every factual claim below need a founder
check against what's actually true on cutover day (pricing, feature list, any
promises about apps/downloads).

**When to send:** step 7 of `docs/cutover-runbook.md` — after data-out is
verified complete and the team has confirmed the new platform actually works,
never before.

**Who:** the ~523 web card-billable members who already have access (this is
not the activation-wave email for members who haven't logged in yet — that's
a separate, already-covered flow via `/activate` links, see WS3 in project
memory). IAP (Apple/Google) members get separate comms, not this one — see
`docs/cutover-runbook.md` step 8.

---

**Subject (draft):** Albunyaan has a new home — nothing changes for you

**Body (draft):**

> Assalamu alaikum,
>
> Albunyaan has moved to a new platform — built and run entirely by us, on our
> own infrastructure, alhamdulillah.
>
> **What stays exactly the same:**
> - Your subscription and price — nothing is being re-charged or changed.
> - The content library and everything you've been watching.
> - Your subscription itself is unaffected; this move doesn't touch your billing.
>
> **What's different:**
> - **How you log in.** No more password — you'll get a secure sign-in link by
>   email each time. Just click "Log in," enter your email, and check your
>   inbox.
> - A cleaner, faster site, built for families — including the same parental
>   controls (PIN-protected kid profiles) you're used to, carried over.
>
> **What you need to do:** nothing, right now — your account already works on
> the new site at [albunyaan.tv]. Next time you visit, just log in with the
> new email-link method above instead of a password.
>
> If anything looks wrong or you can't get in, reply to this email or reach us
> at [support email] — a real person will help, not a bot.
>
> JazakAllahu khairan for being part of this from the beginning. Every
> subscription is a sadaqah jaariyah that keeps this going for families
> everywhere — thank you for making that possible.
>
> — The Albunyaan team

---

## Notes for whoever finalizes this

- Bracketed placeholders (`[albunyaan.tv]`, `[support email]`) need real
  values confirmed at send time — don't guess them into the final copy.
- "No more password" assumes every recipient's old Uscreen account used a
  password — confirm that's actually true for 100% of this cohort before
  stating it as fact.
- Doesn't mention the old Uscreen domain/brand by name — deliberate, keeps
  focus on continuity rather than drawing attention to the switch itself, but
  the founder may prefer more explicit "we've left Uscreen" language instead.
- No mention of a native app — per `apps/web/app/download-app/page.tsx`'s
  honest "still in development" status; don't promise what isn't real yet.
- Consider a short second wave a few days later to anyone who hasn't logged
  in since send — same idea as the activation-wave reminder sequence already
  built for WS3.
