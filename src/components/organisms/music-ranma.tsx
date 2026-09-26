import { component$ } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

/** A decorative, server-rendered transom. Motion needs no client runtime. */
export const MusicRanma = component$(() => (
  <div css={ranmaStyles} class="music-ranma" aria-hidden="true">
    <svg viewBox="0 0 960 248" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <defs>
        {/* Front elevation: broad bouts, long C-bouts and four pointed corners. */}
        <g id="ranma-violin-solid">
          <path d="M0-52C-19-53-34-40-33-27C-33-16-27-9-30-3C-22-5-20 1-20 10C-20 21-24 33-35 31C-32 40-39 47-40 60C-43 80-24 88 0 88C24 88 43 80 40 60C39 47 32 40 35 31C24 33 20 21 20 10C20 1 22-5 30-3C27-9 33-16 33-27C34-40 19-53 0-52Z" />
          <path d="M-4-91H4L5-51H-5ZM-5-113H5L6-87H-6Z" />
          <path d="M-3-134C-6-133-6-128-7-124C-12-125-14-118-10-114L-6-111H6L10-114C14-118 12-125 7-124C6-128 6-133 3-134Z" />
          <path d="M-6-103H-12V-100H-6ZM6-109H12V-106H6ZM-6-90H-12V-87H-6ZM6-96H12V-93H6Z" />
          <ellipse cx="-13" cy="-101.5" rx="4" ry="3.1" />
          <ellipse cx="13" cy="-107.5" rx="4" ry="3.1" />
          <ellipse cx="-13" cy="-88.5" rx="4" ry="3.1" />
          <ellipse cx="13" cy="-94.5" rx="4" ry="3.1" />
        </g>
        <g id="ranma-f-hole" fill="black">
          <path
            d="M-10 14C-9 10-14 9-15 15C-17 22-15 31-20 36C-23 40-27 38-25 35"
            fill="none"
            stroke="black"
            stroke-width="2"
            stroke-linecap="round"
          />
          <circle cx="-10" cy="14" r="1.8" />
          <circle cx="-25" cy="35" r="2.1" />
          <path d="m-16.5 25 2.5-1-1 2Z" />
        </g>
        <mask
          id="ranma-staff-depth"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="960"
          height="248"
        >
          <path d="M0 0H960V248H0Z" fill="white" />
          <use
            href="#ranma-violin-solid"
            transform="translate(480 134) rotate(14) scale(.84)"
            fill="black"
            stroke="black"
            stroke-width="4"
          />
        </mask>
        <mask
          id="ranma-violin-cutouts"
          x="-60"
          y="-140"
          width="120"
          height="245"
          maskUnits="userSpaceOnUse"
        >
          <path d="M-60-140H60V105H-60Z" fill="white" />
          <path d="M-1-88H1L2.4 3H-2.4Z" fill="black" />
          <path d="M-6 48Q0 46 6 48L2.5 76H-2.5Z" fill="black" />
          <path d="M-9 28Q0 25 9 28" fill="none" stroke="black" stroke-width="1.4" />
          <use href="#ranma-f-hole" />
          <use href="#ranma-f-hole" transform="scale(-1 1)" />
          {/* Paired grooves describe the scroll from the same frontal viewpoint. */}
          <path
            d="M-2-132C-3-126-5-120-3-114M2-132C3-126 5-120 3-114M-8-122C-11-120-10-117-7-116M8-122C11-120 10-117 7-116"
            fill="none"
            stroke="black"
            stroke-width="1.2"
            stroke-linecap="round"
          />
          <path d="M-2-109H2V-94H-2Z" fill="black" />
        </mask>
        <clipPath id="ranma-opening">
          <path
            transform="translate(0 248) scale(1 -1)"
            d="M0 76H258Q276 76 285 61L303 38H399Q420 38 437 26H523Q540 38 561 38H657L675 61Q684 76 702 76H960V237H0Z"
          />
        </clipPath>
        <g id="ranma-cloud" stroke-linecap="round" stroke-linejoin="round">
          <path
            d="M0 207C62 207 63 179 91 179H124C146 179 146 150 170 150H216C238 150 237 123 262 123H328C350 123 354 102 375 102"
            stroke="currentColor"
            stroke-width="9"
          />
          <path
            d="M154 150C138 150 139 132 154 130H194M250 124C235 124 234 108 249 105H284"
            stroke="currentColor"
            stroke-width="5"
          />
          <path d="M92 180C77 180 77 165 91 162H109" stroke="currentColor" stroke-width="3" />
        </g>
        <g id="ranma-leaf" fill="currentColor">
          <path d="M0 0C-25-4-34-20-32-35-10-32-1-17 0 0ZM1 0C4-26 18-36 34-36 31-14 17-3 1 0Z" />
        </g>
      </defs>

      <g clip-path="url(#ranma-opening)">
        <g mask="url(#ranma-staff-depth)">
          <g class="ranma-resonance" stroke="currentColor" stroke-width="1.5">
            {[0, 8, 16, 24, 32].map((offset) => (
              <path
                key={offset}
                transform={`translate(0 ${offset})`}
                d="M-24 79C86 35 194 39 298 74S483 126 596 83S813 41 984 79"
              />
            ))}
          </g>
        </g>
        <g transform="translate(0 -32)">
          <use href="#ranma-cloud" />
          <use href="#ranma-cloud" transform="translate(960 0) scale(-1 1)" />

          <g stroke="currentColor" stroke-width="3" stroke-linecap="round">
            <path d="M0 237C101 235 179 257 254 214S360 182 422 256M538 256C600 182 631 172 706 214S859 235 960 237" />
          </g>
          <use href="#ranma-leaf" transform="translate(292 198) rotate(22) scale(.58)" />
          <use href="#ranma-leaf" transform="translate(668 198) rotate(-22) scale(.58)" />

          <g class="ranma-notes" fill="currentColor" stroke="currentColor" stroke-width="2.5">
            <path d="M155 111V76L183 70V104M155 82 183 76" fill="none" />
            <ellipse cx="149" cy="112" rx="7" ry="4.5" transform="rotate(-22 149 112)" />
            <ellipse cx="177" cy="105" rx="7" ry="4.5" transform="rotate(-22 177 105)" />
            <path d="M752 138V103Q773 109 762 121" fill="none" />
            <ellipse cx="746" cy="139" rx="7" ry="4.5" transform="rotate(-22 746 139)" />
            <path d="M832 132V96L857 89V122M832 102 857 95" fill="none" />
            <ellipse cx="826" cy="133" rx="7" ry="4.5" transform="rotate(-22 826 133)" />
            <ellipse cx="851" cy="123" rx="7" ry="4.5" transform="rotate(-22 851 123)" />
          </g>
        </g>
        <g transform="translate(480 134) rotate(14) scale(.84)">
          {/* Transparent f-holes keep the instrument a single cut-paper silhouette. */}
          <g mask="url(#ranma-violin-cutouts)">
            <use href="#ranma-violin-solid" fill="currentColor" />
          </g>
          <g class="ranma-bow" stroke="currentColor" stroke-linejoin="round">
            <path d="M61 80Q57-9 68-108L73-114 73-100" stroke-width="3" />
            <path d="M68 77 73-104" stroke-width="1.8" />
            <path d="M60 67H69V80H60Z" fill="currentColor" stroke-width="1" />
            <path d="M62 80V86" stroke-width="3" />
          </g>
        </g>
      </g>

      {/* The top is flush and straight; the carved shoulders belong to the lower edge. */}
      <path
        transform="translate(0 248) scale(1 -1)"
        d="M0 66H256Q268 66 277 53L296 27H397Q418 27 433 15H527Q542 27 563 27H664L683 53Q692 66 704 66H960V248H0ZM0 76V237H960V76H702Q684 76 675 61L657 38H561Q540 38 523 26H437Q420 38 399 38H303L285 61Q276 76 258 76Z"
        fill="currentColor"
        fill-rule="evenodd"
      />
    </svg>
  </div>
));

const ranmaStyles = css`
  width: 100%;
  color: var(--ink);
  margin: 0 0 clamp(24px, 4vw, 44px);
  box-sizing: border-box;
  pointer-events: none;
  & svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: hidden;
  }
  & .ranma-bow {
    animation: ranma-bow 9s ease-in-out infinite;
  }
  & .ranma-resonance {
    animation: ranma-resonance 12s ease-in-out infinite;
  }
  & .ranma-notes {
    animation: ranma-notes 10s ease-in-out infinite;
  }
  @keyframes ranma-bow {
    0%,
    100% {
      transform: translate(-3px, 1.5px);
    }
    50% {
      transform: translate(3px, -1.5px);
    }
  }
  @keyframes ranma-resonance {
    0%,
    100% {
      transform: translate(-6px, 0);
    }
    50% {
      transform: translate(6px, -2px);
    }
  }
  @keyframes ranma-notes {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-2px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    & .ranma-bow,
    & .ranma-resonance,
    & .ranma-notes {
      animation: none;
    }
  }
  @media print {
    display: none;
  }
`;
