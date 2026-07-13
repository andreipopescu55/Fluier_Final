import enum


class UserRole(str, enum.Enum):
    CLIENT = "client"
    VENUE_ADMIN = "venue_admin"
    SUPER_ADMIN = "super_admin"


class VenueStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    SUSPENDED = "suspended"


class SportType(str, enum.Enum):
    FOOTBALL_5 = "football_5"
    FOOTBALL_7 = "football_7"
    FOOTBALL_11 = "football_11"
    TENNIS = "tennis"
    BASKETBALL = "basketball"
    VOLLEYBALL = "volleyball"


class SurfaceType(str, enum.Enum):
    SYNTHETIC_GRASS = "synthetic_grass"
    NATURAL_GRASS = "natural_grass"
    CLAY = "clay"
    HARD_COURT = "hard_court"
    PARQUET = "parquet"


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class BookingSource(str, enum.Enum):
    ONLINE = "online"
    MANUAL = "manual"


class SubscriptionPlan(str, enum.Enum):
    BASIC = "basic"
    PREMIUM = "premium"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    INCOMPLETE = "incomplete"


class PaymentStatus(str, enum.Enum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"
    PENDING = "pending"


class NotificationType(str, enum.Enum):
    # Client — rezervarile lui
    BOOKING_CONFIRMED = "booking_confirmed"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_REMINDER = "booking_reminder"
    # Find Party — organizator si jucatori
    MATCH_JOIN_REQUEST = "match_join_request"          # organizator: cineva vrea sa intre
    MATCH_REQUEST_APPROVED = "match_request_approved"  # jucator: ai fost acceptat
    MATCH_REQUEST_REJECTED = "match_request_rejected"  # jucator: respins / scos
    MATCH_PLAYER_LEFT = "match_player_left"            # organizator: cineva a iesit
    MATCH_CANCELLED = "match_cancelled"                # jucatori: meciul a fost anulat
    # Venue admin — activitate pe terenurile lui
    VENUE_NEW_BOOKING = "venue_new_booking"            # cineva a rezervat un interval
    VENUE_BOOKING_CANCELLED = "venue_booking_cancelled"  # cineva a anulat
    # Super admin — ce modifica adminii la terenuri
    ADMIN_FIELD_CHANGE = "admin_field_change"


# ── Find Party (meciuri deschise) ────────────────────────────────────────────────
class MatchStatus(str, enum.Enum):
    OPEN = "open"            # caută jucători
    FULL = "full"           # s-au ocupat toate locurile
    CANCELLED = "cancelled"  # organizatorul a anulat
    COMPLETED = "completed"  # meciul a avut loc


class MatchSkillLevel(str, enum.Enum):
    ANY = "any"
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class ParticipantStatus(str, enum.Enum):
    REQUESTED = "requested"  # cerere trimisă, așteaptă aprobare
    APPROVED = "approved"    # acceptat de organizator (ocupă un loc)
    REJECTED = "rejected"    # respins / scos de organizator
    LEFT = "left"            # a ieșit singur din meci
