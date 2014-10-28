CREATE OR REPLACE FUNCTION update_elo_score(winning_contact_id integer, losing_contact_id integer)
  RETURNS void AS
$BODY$
DECLARE
	winning_contact contacts;
	losing_contact contacts;
	tenFactor integer := 400;
	Q_winning double precision;
	Q_losing double precision;
	E_winning double precision;
	E_losing double precision;
	k_winning double precision;
	k_losing double precision;
	new_winning_elo_score double precision;
	new_losing_elo_score double precision;
BEGIN
	
	SELECT * INTO winning_contact FROM contacts WHERE contact_id = winning_contact_id;
	SELECT * INTO losing_contact FROM contacts WHERE contact_id = losing_contact_id;

	Q_winning := 10 ^ (winning_contact.elo_score / tenFactor);
	Q_losing := 10 ^ (losing_contact.elo_score / tenFactor);

	E_winning := Q_winning / (Q_winning + Q_losing);
	E_losing := Q_losing / (Q_winning + Q_losing);

	k_winning := 16 + (16 * exp( -1 * winning_contact.elo_count / 4));
	k_losing := 16 + (16 * exp( -1 * losing_contact.elo_count / 4));

	new_winning_elo_score := winning_contact.elo_score + k_winning * (1 - E_winning);
	new_losing_elo_score := losing_contact.elo_score + k_losing * (0 - E_losing);

	UPDATE contacts SET elo_score = new_winning_elo_score, elo_count = elo_count + 1 WHERE contact_id = winning_contact.contact_id;
	UPDATE contacts SET elo_score = new_losing_elo_score, elo_count = elo_count + 1 WHERE contact_id = losing_contact.contact_id;

	RETURN;
END;
$BODY$
  LANGUAGE plpgsql

