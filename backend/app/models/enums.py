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
    BOOKING_CONFIRMED = "booking_confirmed"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_REMINDER = "booking_reminder"
