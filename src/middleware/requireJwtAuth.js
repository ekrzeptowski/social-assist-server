import passport from 'passport';

const requireJwtAuth = passport.authenticate('jwt', { session: true });

export default requireJwtAuth;
