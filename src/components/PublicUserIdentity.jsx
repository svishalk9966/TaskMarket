import React from 'react';
import { Link } from 'react-router-dom';
import {
  buildPublicProfilePreviewState,
  getProfileInitial,
  getPublicProfileRoute,
} from '../lib/publicProfiles';

const PublicUserIdentity = ({
  userId,
  name,
  photoURL,
  subtitle = '',
  showAction = false,
  actionLabel = 'View Profile',
  containerClassName = '',
  avatarClassName = 'h-10 w-10',
  nameClassName = 'font-semibold',
  subtitleClassName = 'text-xs break-words text-base-content/55',
  actionClassName = 'text-xs font-medium text-primary transition hover:text-primary/80 hover:underline',
  stopPropagation = true,
}) => {
  const route = getPublicProfileRoute(userId);
  const safeName = name || 'User';
  const sharedState = buildPublicProfilePreviewState({ userId, name: safeName, photoURL, subtitle });

  const handleClick = (event) => {
    if (stopPropagation) event.stopPropagation();
  };

  const avatarContent = photoURL ? (
    <img src={photoURL} alt={safeName} className="h-full w-full rounded-full object-cover object-center" style={{ aspectRatio: '1/1' }} />
  ) : (
    <span className="flex items-center justify-center leading-none" style={{ lineHeight: 1 }}>{getProfileInitial(safeName)}</span>
  );

  const avatar = route ? (
    <Link
      to={route}
      state={sharedState}
      onClick={handleClick}
      className={`flex items-center justify-center overflow-hidden rounded-full border border-base-300 bg-base-200 text-sm font-semibold text-primary transition hover:border-primary/35 ${avatarClassName}`}
      aria-label={`Open ${safeName}'s public profile`}
      title={`Open ${safeName}'s public profile`}
    >
      {avatarContent}
    </Link>
  ) : (
    <div className={`flex items-center justify-center overflow-hidden rounded-full border border-base-300 bg-base-200 text-sm font-semibold text-primary ${avatarClassName}`}>
      {avatarContent}
    </div>
  );

  const nameNode = route ? (
    <Link
      to={route}
      state={sharedState}
      onClick={handleClick}
      className={`${nameClassName} transition hover:text-primary`}
      title={`Open ${safeName}'s public profile`}
    >
      {safeName}
    </Link>
  ) : (
    <span className={nameClassName}>{safeName}</span>
  );

  const actionNode = route && showAction ? (
    <Link
      to={route}
      state={sharedState}
      onClick={handleClick}
      className={actionClassName}
    >
      {actionLabel}
    </Link>
  ) : null;

  return (
    <div className={`flex min-w-0 items-start gap-3 ${containerClassName}`.trim()}>
      <div className="avatar shrink-0">{avatar}</div>
      <div className="min-w-0 flex-1">
        <div className="break-words">{nameNode}</div>
        {subtitle ? <div className={subtitleClassName}>{subtitle}</div> : null}
        {actionNode ? <div className="mt-1">{actionNode}</div> : null}
      </div>
    </div>
  );
};

export default PublicUserIdentity;
