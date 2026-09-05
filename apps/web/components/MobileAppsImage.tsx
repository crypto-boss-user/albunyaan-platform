/**
 * Homepage-blok 12 "Mobile apps" (SR 4 stap 7; SR 2a home__1440__en `.mobile-apps--block-image`; B63: beeld ja).
 * Letterlijk de gemeten opbouw: één SVG 1327×667 met een telefoonscherm-masker waarin het schermbeeld
 * (`thumpnail.1722973512.jpg`, 1004×464) valt, en daaroverheen de handen (`hands.png`, 821×494) — beide byte-identiek
 * uit `var/storefront-referentie/assets/`. De storefront toont in dit blok géén titel, tekst of store-knoppen (SR 2b
 * index.json paneel 12: App Store/Google Play leeg) — de store-links staan in de footer (stap 5, B63).
 * De ongebruikte `<defs>`-patronen uit de bron (verwijzen naar niet-bestaande images) zijn weggelaten.
 */
export default function MobileAppsImage() {
  return (
    <svg
      className="w-full h-auto max-w-4xl mx-auto"
      width="1327"
      height="667"
      viewBox="0 0 1327 667"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="watch on your mobile"
    >
      <mask id="mask0_4:7" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="294" y="137" width="685" height="314">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M347.164 450.965C339.863 450.965 332.717 450.978 325.299 450.571C308.212 448.665 299.956 441.194 295.995 428.963C294.999 425.378 294.087 421.474 294 416.367C294.008 398.791 294.005 375.075 294 358.721V229.275C294.005 212.922 294.008 189.207 294 171.632C294.087 166.523 294.999 162.621 295.995 159.035C299.956 146.806 308.212 139.335 325.299 137.43C332.717 137.022 339.863 137.036 347.166 137.036C386.11 136.884 426.759 137.276 465.703 137.125C586.034 137.125 705.091 137.195 825.421 137.195C857.216 137.195 914.142 137.306 945.936 137.306C952.302 137.606 960.583 140.099 964.753 142.946C973.987 149.28 978.942 160.939 978.998 168.599C979.003 179.125 978.998 190.676 978.998 202.729C978.998 203.956 978.402 206.757 973.65 206.768C963.09 206.794 953.692 214.277 953.692 225.106C953.692 238.626 953.678 270.942 953.662 301.628C953.674 327.224 953.685 351.605 953.684 362.89C953.684 373.72 963.082 381.203 973.642 381.229C978.394 381.24 978.989 384.042 978.99 385.268C978.99 397.323 978.995 408.874 978.99 419.401C978.934 427.059 973.98 438.719 964.745 445.054C960.574 447.901 952.294 450.394 945.928 450.695C914.134 450.695 857.209 450.806 825.415 450.806C705.085 450.806 586.031 450.874 465.7 450.874C426.757 450.725 386.108 451.114 347.164 450.965Z"
          fill="white"
        />
      </mask>
      <g mask="url(#mask0_4:7)">
        <foreignObject x="287" y="125" width="695" height="330">
          <img src="/home/thumpnail.1722973512.jpg" alt="watch on your mobile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </foreignObject>
      </g>
      <foreignObject x="109" width="1109" height="668">
        <img src="/home/hands.png" alt="" style={{ width: '100%', height: 'auto' }} />
      </foreignObject>
    </svg>
  );
}
