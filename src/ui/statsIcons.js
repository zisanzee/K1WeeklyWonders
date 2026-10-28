// statsIcons.js
// The ONE place the stats/teacher surfaces map a concept to an icon.
//
// Why a shared module instead of importing icons at each call site:
//
//   The emoji these replace were duplicated inline, and that is exactly how the
//   bug happened that prompted this change: the "Mission heroes" button and the
//   past-winners toggle BOTH rendered 🏆, so on mobile (where the labels are
//   hidden) the header showed two identical trophies side by side. A single map
//   makes a collision obvious and greppable.
//
// ICONS ONLY — GAME ART IS EXCLUDED.
//   Anything that identifies a GAME (its emoji from the catalogue, or its icon
//   image via GameIcon) stays exactly as it is. Those are data, not chrome: they
//   come from the registry and are what a child recognises. This module is for
//   interface icons only (refresh, delete, search, trophy, ...).
//
// All names come from react-icons/lu (lucide). Using one icon family keeps the
// stroke weight and corner radius consistent, which is what makes a set of small
// glyphs look designed rather than assembled.
import {
  LuArrowLeft,
  LuBookMarked,
  LuBookOpen,
  LuCalendarDays,
  LuChartColumn,
  LuCircleAlert,
  LuClock,
  LuCoffee,
  LuCrown,
  LuDumbbell,
  LuEye,
  LuFlame,
  LuFlaskConical,
  LuFolder,
  LuFrown,
  LuGamepad2,
  LuGlobe,
  LuGraduationCap,
  LuHand,
  LuHourglass,
  LuHouse,
  LuImage,
  LuHash,
  LuKeyRound,
  LuLightbulb,
  LuLink,
  LuList,
  LuLoader,
  LuLock,
  LuLockOpen,
  LuMedal,
  LuMonitorSmartphone,
  LuMousePointerClick,
  LuPartyPopper,
  LuPencil,
  LuPointer,
  LuPrinter,
  LuPuzzle,
  LuRefreshCw,
  LuSchool,
  LuScrollText,
  LuSearch,
  LuSearchX,
  LuSettings,
  LuSparkles,
  LuStar,
  LuTarget,
  LuTimer,
  LuTrash2,
  LuTrophy,
  LuUndo2,
  LuTriangleAlert,
  LuUsers,
  LuX,
} from 'react-icons/lu';

// ---------------------------------------------------------------------------
// Section / navigation
// ---------------------------------------------------------------------------

// Navigation.
export const ArrowLeftIcon = LuArrowLeft;

// Stats — the panel itself.
export const StatsIcon = LuChartColumn;

// Weekly Mission Heroes. Deliberately NOT the same glyph as PastWinnersIcon:
// these two sit next to each other in the header, and giving both a trophy is
// what made them indistinguishable on a phone.
export const MissionHeroesIcon = LuSparkles;

// Past weekly winners — the trophy is the right metaphor for a past champion.
export const PastWinnersIcon = LuTrophy;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export const RefreshIcon = LuRefreshCw;
export const CloseIcon = LuX;
export const SearchIcon = LuSearch;
export const ClearIcon = LuX;
export const DeleteIcon = LuTrash2;

// ---------------------------------------------------------------------------
// Metrics — these label a NUMBER, so the glyph carries meaning
// ---------------------------------------------------------------------------
export const MistakesIcon = LuCircleAlert;
export const StreakIcon = LuFlame;
export const TimeIcon = LuTimer;
export const PlayIcon = LuMousePointerClick;
export const PlayersIcon = LuList;
export const TargetIcon = LuTarget;
export const DeviceIcon = LuMonitorSmartphone;
export const PlayedAtIcon = LuCalendarDays;

// ---------------------------------------------------------------------------
// Rankings / highlights (student detail + games)
// ---------------------------------------------------------------------------
export const FavouriteIcon = LuStar;
export const StrongestIcon = LuDumbbell;
export const HardestIcon = LuPuzzle;
export const WinnerIcon = LuCrown;
export const RankIcon = LuMedal;

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
export const LoadingIcon = LuLoader;
export const SlowIcon = LuCoffee;
export const ErrorIcon = LuFrown;
export const HourglassIcon = LuHourglass;
export const AllGamesIcon = LuTarget;
export const TermIcon = LuFolder;
export const SummaryIcon = LuList;
export const AllPlaysIcon = LuScrollText;

// ---------------------------------------------------------------------------
// Teacher panel — tabs
//
// The tab bar used emoji, which read at different weights per platform and sat
// visually inconsistent against the lucide icons now used everywhere else in the
// panel. Each tab gets the glyph that names its JOB, not a decorative sparkle.
// ---------------------------------------------------------------------------
export const GamesTabIcon = LuGamepad2;
export const CatalogueTabIcon = LuBookOpen;
export const StudentsTabIcon = LuGraduationCap;
export const StatsTabIcon = LuChartColumn;
export const SettingsTabIcon = LuSettings;
export const ClassesTabIcon = LuSchool;

// ---------------------------------------------------------------------------
// Teacher panel — actions and states
// ---------------------------------------------------------------------------
export const EditIcon = LuPencil;
export const UndoIcon = LuUndo2;
export const RestoreIcon = LuUndo2;
export const WarningIcon = LuTriangleAlert;
export const PeopleIcon = LuUsers;

// FEATURED — what a "shiny" game is called in the UI.
//
// This was ✨, which is the generic "sparkle" glyph and reads as decoration
// rather than a state you can toggle. A star is the conventional, unambiguous
// marker for "featured/pinned" and — unlike a sparkle — it holds up at 14px in a
// list row.
export const FeaturedIcon = LuStar;

// ---------------------------------------------------------------------------
// Catalogue / class settings
// ---------------------------------------------------------------------------
export const UnlockScheduleIcon = LuClock;
export const PreviewIcon = LuFlaskConical;
export const TryItIcon = LuEye;
export const EmptySearchIcon = LuSearchX;
export const CopyLinkIcon = LuLink;
export const AccessCodeIcon = LuKeyRound;
export const PrivateIcon = LuLock;
export const PublicIcon = LuGlobe;
export const WelcomeIcon = LuHand;
export const ClassIcon = LuSchool;
export const ClassGamesIcon = LuGamepad2;
export const GuideIcon = LuBookMarked;
export const BadgeArtIcon = LuImage;
export const GreetingIcon = LuHand;
export const SearchEmptyIcon = LuSearchX;

// ---------------------------------------------------------------------------
// Teacher guide (/teacher-onboarding)
//
// The guide's content file stores an `icon` per section, card and callout. Those
// fields now hold COMPONENTS, so the lesson structure carries its own icon set
// and adding a section needs no change to the renderer.
// ---------------------------------------------------------------------------
export const GuideLoginIcon = LuKeyRound;
export const GuideHintIcon = LuLightbulb;
export const GuideGamesIcon = LuGamepad2;
export const GuideLockedIcon = LuLock;
export const GuideUnlockedIcon = LuLockOpen;
export const GuideScheduleIcon = LuClock;
export const GuideTapIcon = LuPointer;
export const GuideCatalogueIcon = LuBookOpen;
export const GuideStudentsIcon = LuGraduationCap;
export const GuideLinkIcon = LuLink;
export const GuideCodeIcon = LuHash;
export const GuidePrintIcon = LuPrinter;
export const GuideStatsIcon = LuChartColumn;
export const GuideTrashIcon = LuTrash2;
export const GuideSettingsIcon = LuSettings;
export const GuideWarningIcon = LuTriangleAlert;
export const GuidePrivacyIcon = LuGlobe;
export const GuideCompleteIcon = LuPartyPopper;
export const GuideHomeIcon = LuHouse;
export const GuidePanelIcon = LuSchool;
