-- Frozen turnout denominator: the count of eligible (isMember) users at the
-- moment a motion's voting window opened, so a closed motion's "X of Y voted"
-- stays accurate as membership changes after the fact.
ALTER TABLE "governance"."Motion"
  ADD COLUMN "eligibleMemberCount" INTEGER;
