CREATE OR REPLACE FUNCTION matchflare_score(contact_row contacts) RETURNS real AS $$
DECLARE
	score real := 100;
BEGIN
	IF contact_row.verified = TRUE THEN
		score := score + 50;
	ELSIF contact_row.guessed_gender != 'UNKNOWN' THEN
		score := score + 35;
	END IF;
	RETURN score;
END;

$$ LANGUAGE plpgsql;


--WORKING QUERY!!
SELECT c1.contact_id first_contact_id, c1.guessed_full_name first_contact_name, c1.guessed_gender first_contact_gender, c2.contact_id second_contact_id, c2.guessed_full_name second_contact_name, c2.guessed_gender second_contact_gender
	FROM contacts c1, contacts c2 
		WHERE c1.contact_id IN 	--Make sure the first matched person is a contact of the matcher
			(SELECT unnest(contacts) FROM contacts WHERE contact_id = 90) 
		AND c2.contact_id IN  --Make sure the second matched person is a contact of the matcher
			(SELECT unnest(contacts) FROM contacts WHERE contact_id = 90)
		AND c2.guessed_gender IN  --Make sure the second matched person is of the first matched person's preferred gender
			(SELECT unnest(guess_preferences(c1.guessed_gender)))	
		AND c1.contact_id != c2.contact_id --Make sure the first and second matched person are different
		AND c1.contact_id != 90 --Make sure the first matched person is the not the matcher
		AND c2.contact_id != 90 --Make sure the second matched person is the not the matcher
ORDER BY (random()*0.5+1) * (matchflare_score(c1)) DESC;