# Importam toate modelele aici — ordinea conteaza.
# SQLAlchemy inregistreaza fiecare model in Base.metadata cand e importat.
# init_db.py importa acest fisier inainte de create_all().

# Enums (fara dependinte)
from app.models.enums import (  # noqa: F401
    UserRole, VenueStatus, SportType, SurfaceType,
    BookingStatus, BookingSource, SubscriptionPlan,
    SubscriptionStatus, PaymentStatus, NotificationType,
)

# Modele (in ordinea dependintelor FK)
from app.models.user import User                          # noqa: F401
from app.models.venue import Venue, VenueImage            # noqa: F401
from app.models.facility import Facility, VenueFacility   # noqa: F401
from app.models.field import Field, PricingRule           # noqa: F401
from app.models.booking import Booking                    # noqa: F401
from app.models.subscription import Subscription, Payment # noqa: F401
from app.models.notification import Notification          # noqa: F401
from app.models.audit_log import AuditLog                 # noqa: F401
from app.models.rating import Rating                      # noqa: F401
