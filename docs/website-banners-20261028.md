# Games-page banner preparation

One website banner placement is prepared above the Games filters, separate from
game buttons and the game player. Its local preview is available at:

http://localhost:3012/?banner-preview=1#games

This is a layout preview, not a real advertisement. Public deployments render
no banner, leave no blank space and make no advertising requests. There is no
ad-network script, tracking, impression collection or revenue generation.

## Before connecting live advertising

1. Confirm that the hosting plan permits commercial use. Vercel Hobby is for
   personal, non-commercial use; the actual account plan has not been verified.
2. Apply to the chosen network and obtain site approval. For AdSense, complete
   the signup and site-verification tasks in the publisher's own account.
   A parent or guardian must hold the AdSense account if the publisher is under 18.
3. Address original-content, game/content permissions and reviewer-access
   requirements. Neon currently uses authenticated access and many external
   game frames; preparing a banner is not proof of AdSense eligibility.
4. Supply the approved network's actual banner code and publisher/slot IDs.
   Connect its consent/privacy requirements, verification file/meta tag and
   ads.txt details as provided by the account. Do not invent those values.
5. Integrate and test that specific tag in this placement, without auto-refresh,
   pop-ups, gameplay overlays or changes to the existing iframe contents.

Official guidance:
- https://support.google.com/adsense/answer/10162
- https://support.google.com/adsense/answer/9724
- https://support.google.com/adsense/answer/7584263
- https://vercel.com/docs/limits/fair-use-guidelines
