import logging

from .kompassi_client import kompassi_get, user_defaults_from_kompassi, KompassiError

from django.contrib.auth import get_user_model
User = get_user_model()

log = logging.getLogger('kompassi_crowd')


class KompassiCrowdAuthenticationBackend(object):
    def authenticate(self, username=None, password=None):
        if password is not None:
            log.debug(u'KompassiCrowdAuthenticationBackend called with password, passing to next backend')
            return None

        try:
            kompassi_user = kompassi_get('people', username)
        except KompassiError as e:
            log.error(u'failed to get kompassi user {username}: {e}'.format(username=username, e=e))
            return None

        user, created = User.objects.get_or_create(
            username=username,
            defaults=user_defaults_from_kompassi(kompassi_user)
        )

        return user

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
