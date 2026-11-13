import { useId } from "react";

import { CONNECTED_WAITING_REPLY_TEXT } from "@/lib/solmind/explorerConversationConnectedScreen";

import styles from "./ExplorerWaitingIndicator.module.css";

// Approved revision 3 artwork, using its dark-background paint for this transcript.
// The connected screen owns the one persistent live region; this visible row
// opts out of the transcript log's announcements.
export function ExplorerWaitingIndicator() {
  const prefix = useId();
  const id = (name: string) => `explorer-waiting-${prefix}-${name}`;
  const paint = (name: string) => `url(#${id(name)})`;

  return (
    <div aria-live="off" className={styles.waiting} data-waiting-indicator="">
      <span className={styles.ecl}>
        <svg className={styles.eclipse} viewBox="5 5 38 38" aria-hidden="true" focusable="false">
          <defs>
            <filter id={id("b1")} filterUnits="userSpaceOnUse" x="-14" y="-14" width="76" height="76"><feGaussianBlur stdDeviation=".12" /></filter>
            <filter id={id("b2")} filterUnits="userSpaceOnUse" x="-14" y="-14" width="76" height="76"><feGaussianBlur stdDeviation=".3" /></filter>
            <filter id={id("b3")} filterUnits="userSpaceOnUse" x="-14" y="-14" width="76" height="76"><feGaussianBlur stdDeviation=".5" /></filter>
            <filter id={id("b4")} filterUnits="userSpaceOnUse" x="-14" y="-14" width="76" height="76"><feGaussianBlur stdDeviation="1.1" /></filter>
            <radialGradient id={id("glow-d")} gradientUnits="userSpaceOnUse" cx="24" cy="24" r="26">
              <stop offset=".55" stopColor="#FFD98E" stopOpacity=".9" /><stop offset=".64" stopColor="#FDB64A" stopOpacity=".5" />
              <stop offset=".78" stopColor="#F57602" stopOpacity=".2" /><stop offset=".9" stopColor="#F57602" stopOpacity=".06" />
              <stop offset="1" stopColor="#F57602" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={id("stream-d")} gradientUnits="userSpaceOnUse" cx="24" cy="24" r="26">
              <stop offset=".55" stopColor="#FFF1CC" stopOpacity="1" /><stop offset=".68" stopColor="#FFD98E" stopOpacity=".55" />
              <stop offset=".84" stopColor="#FDB64A" stopOpacity=".18" /><stop offset="1" stopColor="#F57602" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={id("moon-d")} cx=".72" cy=".28" r=".95">
              <stop offset="0" stopColor="#1B120B" /><stop offset=".4" stopColor="#0E0906" /><stop offset="1" stopColor="#060403" />
            </radialGradient>
            <radialGradient id={id("arc-d")} gradientUnits="userSpaceOnUse" cx="34.6" cy="13.4" r="15">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="1" /><stop offset=".4" stopColor="#FFE7B0" stopOpacity=".7" />
              <stop offset=".75" stopColor="#FDB64A" stopOpacity=".2" /><stop offset="1" stopColor="#F57602" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={id("limb")} gradientUnits="userSpaceOnUse" x1="35.5" y1="12.5" x2="24" y2="24">
              <stop offset="0" stopColor="#FFE7B0" stopOpacity=".9" /><stop offset=".5" stopColor="#FDB64A" stopOpacity=".25" />
              <stop offset="1" stopColor="#F57602" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={id("face")} gradientUnits="userSpaceOnUse" x1="6.5" y1="1.5" x2="15.5" y2="19.6">
              <stop offset="0" stopColor="#F57602" stopOpacity="0" /><stop offset=".16" stopColor="#FDB64A" stopOpacity=".85" />
              <stop offset=".42" stopColor="#FFF1CC" stopOpacity="1" /><stop offset=".72" stopColor="#F59A2A" stopOpacity=".9" />
              <stop offset="1" stopColor="#F57602" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={id("bloom-d")} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="8.5">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="1" /><stop offset=".18" stopColor="#FFF6E2" stopOpacity="1" />
              <stop offset=".34" stopColor="#FFD98E" stopOpacity=".8" /><stop offset=".58" stopColor="#FDB64A" stopOpacity=".38" />
              <stop offset=".8" stopColor="#F57602" stopOpacity=".1" /><stop offset="1" stopColor="#F57602" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={id("ray-d")} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="8.2">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="1" /><stop offset=".4" stopColor="#FFF1CC" stopOpacity=".92" />
              <stop offset="1" stopColor="#FFD98E" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle className={styles.glow} cx="24" cy="24" r="26" fill={paint("glow-d")} />
          <g className={styles.plumes} fill={paint("stream-d")} filter={paint("b3")} opacity=".5"><path d="M38.08 25.83 Q41.91 24.95 45.66 24.85 Q41.92 23.17 38.03 21.82ZM33.41 13.36 Q34.95 10.48 37.43 8.38 Q33.87 9.67 30.83 11.55ZM27.18 10.16 Q26.58 7.93 26.17 5.78 Q25.47 7.79 24.41 9.81ZM16.16 12.16 Q14.92 11.04 14.29 9.51 Q14.29 11.51 14.57 13.38ZM10.58 19.35 Q6.11 19.10 1.73 18.64 Q5.79 20.44 9.91 22.27ZM12.88 32.84 Q10.90 35.79 8.08 37.77 Q12.11 37.01 15.74 35.55ZM25.27 38.14 Q26.99 40.03 29.02 41.71 Q28.23 39.75 28.36 37.52ZM33.03 34.96 Q35.42 36.23 37.75 37.50 Q36.13 35.53 34.77 33.26Z" /></g>
          <g className={styles.streamers} fill={paint("stream-d")} filter={paint("b2")}>
            <path opacity=".85" d="M36.80 17.84 Q38.00 16.58 39.01 15.02 Q37.82 16.25 36.35 17.00ZM34.35 14.28 Q34.99 13.25 35.64 12.25 Q34.77 13.03 33.78 13.71ZM12.16 16.16 Q10.06 14.84 8.32 12.99 Q9.86 15.15 11.68 16.94ZM9.94 25.97 Q4.94 26.65 -0.15 26.59 Q4.99 27.00 10.06 26.69ZM21.76 38.02 Q21.67 41.36 22.16 44.74 Q21.83 41.38 22.11 38.07ZM24.92 38.17 Q25.18 39.04 25.49 39.90 Q25.32 39.02 25.31 38.14ZM27.65 37.72 Q27.86 38.68 27.69 39.73 Q28.03 38.63 28.12 37.59ZM30.18 36.79 Q30.63 37.57 30.72 38.53 Q30.88 37.45 30.85 36.44ZM34.50 33.56 Q35.47 33.82 36.52 33.98 Q35.68 33.57 35.07 32.90Z" />
            <path opacity=".5" d="M38.18 24.70 Q40.30 24.43 42.41 23.96 Q40.31 24.19 38.20 24.11ZM38.09 22.21 Q43.73 21.24 49.44 20.73 Q43.66 20.76 37.93 21.24ZM37.54 19.72 Q39.63 18.63 41.73 17.60 Q39.48 18.23 37.19 18.74ZM35.33 15.44 Q36.05 14.40 36.76 13.36 Q35.84 14.15 34.78 14.75ZM32.84 12.89 Q33.87 11.61 35.15 10.55 Q33.72 11.50 32.47 12.61ZM29.82 11.05 Q31.06 7.65 32.06 4.16 Q30.93 7.59 29.53 10.92ZM27.77 10.31 Q28.18 9.32 29.02 8.46 Q28.04 9.28 27.41 10.22ZM26.91 10.10 Q26.84 9.10 26.90 8.12 Q26.54 9.04 26.10 9.96ZM24.47 9.81 Q24.35 8.96 24.24 8.12 Q24.22 8.96 24.11 9.80ZM23.12 9.83 Q22.79 8.98 22.61 8.12 Q22.46 9.01 22.23 9.91ZM19.92 10.40 Q19.81 9.65 20.10 8.79 Q19.68 9.69 19.56 10.51ZM16.75 11.79 Q15.30 9.47 14.36 6.86 Q14.98 9.67 16.00 12.27ZM15.50 12.62 Q15.01 12.00 14.74 11.21 Q14.88 12.10 15.14 12.90ZM14.32 13.61 Q12.81 12.66 11.08 11.97 Q12.66 12.82 13.91 14.01ZM10.89 18.54 Q9.53 18.36 8.19 18.17 Q9.42 18.67 10.59 19.34ZM10.07 21.26 Q7.29 20.95 4.58 20.27 Q7.22 21.35 9.91 22.24ZM9.83 23.12 Q8.09 23.01 6.39 22.42 Q8.08 23.28 9.80 23.79ZM11.74 31.16 Q8.89 33.12 6.14 35.24 Q8.98 33.27 11.94 31.49ZM12.86 32.81 Q9.64 35.17 5.99 36.96 Q9.77 35.34 13.16 33.18ZM13.76 33.84 Q12.45 35.61 11.43 37.66 Q12.54 35.71 13.99 34.07ZM14.89 34.89 Q13.85 36.89 12.88 38.92 Q14.17 37.13 15.68 35.51ZM19.56 37.49 Q19.40 38.69 19.04 39.82 Q19.70 38.78 20.35 37.72ZM22.50 38.12 Q23.00 39.11 23.72 40.08 Q23.39 39.13 23.56 38.19ZM25.99 38.06 Q26.69 38.72 27.60 39.31 Q27.06 38.65 27.01 37.88ZM31.84 35.84 Q33.45 37.27 35.33 38.48 Q33.73 37.07 32.53 35.35ZM36.80 30.14 Q38.04 30.69 39.19 31.43 Q38.11 30.53 36.98 29.75ZM37.37 28.80 Q38.85 29.51 40.16 30.67 Q38.89 29.40 37.46 28.52ZM38.02 26.23 Q41.97 26.57 45.92 26.93 Q42.01 26.27 38.11 25.57Z" />
            <path opacity=".28" d="M37.96 21.38 Q40.02 21.00 42.14 20.96 Q39.99 20.82 37.87 20.94ZM36.42 17.11 Q41.35 14.10 46.55 11.59 Q41.08 13.66 35.87 16.21ZM31.25 11.79 Q31.70 10.85 32.42 10.07 Q31.46 10.71 30.62 11.44ZM22.17 9.92 Q21.81 8.78 21.82 7.59 Q21.41 8.84 21.12 10.10ZM18.73 10.81 Q17.99 9.72 17.17 8.66 Q17.79 9.80 18.22 11.03ZM13.06 14.95 Q11.56 14.16 10.14 13.27 Q11.32 14.47 12.45 15.74ZM11.47 17.32 Q10.13 17.03 8.73 16.88 Q10.02 17.25 11.18 17.90ZM10.24 20.47 Q6.72 19.56 3.32 18.15 Q6.66 19.78 10.12 21.00ZM10.04 26.59 Q7.73 27.47 5.53 28.80 Q7.76 27.63 10.12 27.00ZM10.69 28.94 Q9.45 29.42 8.03 29.34 Q9.58 29.73 11.02 29.76ZM11.34 30.43 Q8.71 32.22 6.19 34.20 Q8.84 32.47 11.66 31.02ZM16.35 35.97 Q15.66 37.23 14.64 38.29 Q15.91 37.39 17.02 36.37ZM17.61 36.68 Q16.59 39.91 15.93 43.28 Q16.90 40.05 18.32 37.02ZM29.67 37.02 Q29.97 37.83 29.92 38.77 Q30.12 37.76 30.08 36.83ZM32.91 35.06 Q33.93 35.72 34.96 36.35 Q34.17 35.51 33.55 34.51ZM35.27 32.64 Q36.35 33.14 37.28 33.84 Q36.57 32.83 35.84 31.83ZM37.61 28.06 Q38.94 28.40 40.13 29.19 Q39.02 28.11 37.81 27.29Z" />
          </g>
          <g className={styles.ringglow} fill="none">
            <circle cx="24" cy="24" r="15.5" stroke="#F57602" strokeWidth="2.2" opacity=".7" filter={paint("b4")} />
            <circle cx="24" cy="24" r="15.25" stroke="#FDB64A" strokeWidth=".9" opacity=".9" filter={paint("b3")} />
          </g>
          <circle className={styles.sun} cx="24" cy="24" r="15.2" filter={paint("b1")} />
          <circle className={styles.arc} cx="24" cy="24" r="15.35" fill="none" stroke={paint("arc-d")} strokeWidth="1.5" filter={paint("b3")} />
          <g className={styles.moon}>
            <circle cx="24" cy="24" r="15" fill={paint("moon-d")} />
            <circle className={styles.limb} cx="24" cy="24" r="14.55" fill="none" stroke={paint("limb")} strokeWidth="1.1" filter={paint("b3")} />
            <g className={styles.face} transform="translate(24 24) scale(1.2195) translate(-9.6 -9.4) scale(.8)" fill="none" stroke={paint("face")} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.72 1.66C6.87 1.66 7.27 1.64 7.62 1.68C7.97 1.72 8.46 1.8 8.8 1.88C9.14 1.96 9.34 2.02 9.66 2.15C9.98 2.29 10.36 2.44 10.74 2.67C11.12 2.91 11.57 3.23 11.95 3.56C12.32 3.89 12.71 4.35 12.97 4.65C13.23 4.96 13.33 5.08 13.48 5.39C13.64 5.69 13.79 6.28 13.88 6.5C13.97 6.73 13.93 6.65 14.03 6.76C14.13 6.86 14.12 6.96 14.46 7.16C14.81 7.36 15.51 7.77 16.08 7.95C16.65 8.13 17.52 8.17 17.87 8.24C18.22 8.32 18.1 8.33 18.18 8.39C18.27 8.46 18.34 8.55 18.37 8.65C18.4 8.75 18.4 8.88 18.38 8.99C18.35 9.11 18.44 9.08 18.22 9.34C18 9.6 17.19 10.29 17.05 10.54C16.91 10.78 17.25 10.59 17.38 10.78C17.51 10.98 17.64 11.42 17.81 11.72C17.99 12.02 18.33 12.28 18.44 12.61C18.56 12.94 18.45 13.42 18.49 13.68C18.53 13.95 18.69 14.04 18.69 14.18C18.69 14.32 18.49 14.42 18.49 14.52C18.48 14.62 18.48 14.62 18.66 14.79C18.84 14.95 19.36 15.34 19.54 15.51C19.71 15.68 19.67 15.72 19.71 15.83C19.75 15.94 19.77 16.06 19.77 16.17C19.77 16.28 19.76 16.41 19.71 16.51C19.67 16.61 19.64 16.68 19.5 16.79C19.36 16.9 19.23 17.02 18.87 17.17C18.52 17.32 17.85 17.51 17.37 17.7C16.89 17.89 16.35 18.12 16 18.31C15.65 18.5 15.49 18.63 15.27 18.83C15.06 19.04 14.79 19.4 14.69 19.52" strokeWidth="1.5" opacity=".35" filter={paint("b3")} />
              <path d="M6.72 1.66C6.87 1.66 7.27 1.64 7.62 1.68C7.97 1.72 8.46 1.8 8.8 1.88C9.14 1.96 9.34 2.02 9.66 2.15C9.98 2.29 10.36 2.44 10.74 2.67C11.12 2.91 11.57 3.23 11.95 3.56C12.32 3.89 12.71 4.35 12.97 4.65C13.23 4.96 13.33 5.08 13.48 5.39C13.64 5.69 13.79 6.28 13.88 6.5C13.97 6.73 13.93 6.65 14.03 6.76C14.13 6.86 14.12 6.96 14.46 7.16C14.81 7.36 15.51 7.77 16.08 7.95C16.65 8.13 17.52 8.17 17.87 8.24C18.22 8.32 18.1 8.33 18.18 8.39C18.27 8.46 18.34 8.55 18.37 8.65C18.4 8.75 18.4 8.88 18.38 8.99C18.35 9.11 18.44 9.08 18.22 9.34C18 9.6 17.19 10.29 17.05 10.54C16.91 10.78 17.25 10.59 17.38 10.78C17.51 10.98 17.64 11.42 17.81 11.72C17.99 12.02 18.33 12.28 18.44 12.61C18.56 12.94 18.45 13.42 18.49 13.68C18.53 13.95 18.69 14.04 18.69 14.18C18.69 14.32 18.49 14.42 18.49 14.52C18.48 14.62 18.48 14.62 18.66 14.79C18.84 14.95 19.36 15.34 19.54 15.51C19.71 15.68 19.67 15.72 19.71 15.83C19.75 15.94 19.77 16.06 19.77 16.17C19.77 16.28 19.76 16.41 19.71 16.51C19.67 16.61 19.64 16.68 19.5 16.79C19.36 16.9 19.23 17.02 18.87 17.17C18.52 17.32 17.85 17.51 17.37 17.7C16.89 17.89 16.35 18.12 16 18.31C15.65 18.5 15.49 18.63 15.27 18.83C15.06 19.04 14.79 19.4 14.69 19.52" strokeWidth=".42" />
            </g>
          </g>
          <g transform="translate(34.6 13.4)">
            <circle className={styles.bloom} r="8.5" fill={paint("bloom-d")} />
            <g className={styles.rays} fill={paint("ray-d")} filter={paint("b1")}>
              <path d="M-0.11 -0.26 L6.39 -2.87 L0.11 0.26ZM-0.11 0.26 L-5.89 -2.57 L0.11 -0.26ZM0.27 0.07 L-1.95 7.59 L-0.27 -0.07Z" />
              <path opacity=".85" d="M0.01 -0.20 L4.56 0.22 L-0.01 0.20ZM-0.15 -0.13 L1.71 -2.09 L0.15 0.13ZM-0.19 -0.05 L0.75 -2.89 L0.19 0.05ZM-0.20 0.04 L-0.75 -3.55 L0.20 -0.04ZM-0.15 0.13 L-1.71 -1.89 L0.15 -0.13ZM-0.01 0.20 L-4.19 -0.14 L0.01 -0.20ZM0.10 0.17 L-2.74 1.67 L-0.10 -0.17ZM0.17 0.11 L-1.64 2.41 L-0.17 -0.11ZM0.19 -0.05 L0.64 2.57 L-0.19 0.05ZM0.15 -0.13 L2.63 2.91 L-0.15 0.13ZM0.08 -0.18 L2.72 1.24 L-0.08 0.18Z" />
            </g>
            <circle className={styles.bead} r="1.6" fill="#FFFFFF" filter={paint("b2")} />
          </g>
        </svg>
      </span>
      <span>{CONNECTED_WAITING_REPLY_TEXT}</span>
    </div>
  );
}
