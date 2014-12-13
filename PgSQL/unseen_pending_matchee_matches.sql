 SELECT * FROM
	--Union together the matches when this person is the first matchee and when this person is the second matchee
	(
	(SELECT c1.first_seen_at matcher_seen_at, c2.first_seen_at main_seen_at, c2.chat_id main_chat_id, c1.chat_id matcher_chat_id, pairs.created_at,
		pairs.chat_id, pair_id, matcher.guessed_full_name AS matcher_full_name, first.guessed_full_name AS first_full_name, second.guessed_full_name AS second_full_name, 
		matcher.image_url AS matcher_image, first.image_url AS first_image, second.image_url AS second_image, matcher.guessed_gender AS matcher_gender, 
		matcher.contact_id AS matcher_contact_id, first.contact_id AS first_contact_id, second.contact_id AS second_contact_id, 
		first_contact_status, second_contact_status, is_anonymous, first_matcher_chat_id, second_matcher_chat_id 
	FROM pairs
	LEFT OUTER JOIN chats c1 ON pairs.first_matcher_chat_id = c1.chat_id
	LEFT OUTER JOIN chats c2 ON pairs.chat_id = c2.chat_id
	INNER JOIN contacts AS matcher ON matcher.contact_id = pairs.matcher_contact_id 
	INNER JOIN contacts AS first ON first.contact_id = pairs.first_contact_id 
	INNER JOIN contacts AS second ON second.contact_id = pairs.second_contact_id 
	WHERE first.contact_id = 262 AND (
		(first_contact_status = 'NOTIFIED') OR
		(first_contact_status = 'ACCEPT' AND second_contact_status = 'ACCEPT')))

	UNION

	(SELECT c1.second_seen_at matcher_seen_at, c2.second_seen_at main_seen_at, c2.chat_id main_chat_id, c1.chat_id matcher_chat_id, pairs.created_at,
		pairs.chat_id, pair_id, matcher.guessed_full_name AS matcher_full_name, first.guessed_full_name AS first_full_name, second.guessed_full_name AS second_full_name, 
		matcher.image_url AS matcher_image, first.image_url AS first_image, second.image_url AS second_image, matcher.guessed_gender AS matcher_gender, 
		matcher.contact_id AS matcher_contact_id, first.contact_id AS first_contact_id, second.contact_id AS second_contact_id, 
		first_contact_status, second_contact_status, is_anonymous, first_matcher_chat_id, second_matcher_chat_id 
	FROM pairs
	LEFT OUTER JOIN chats c1 ON pairs.second_matcher_chat_id = c1.chat_id
	LEFT OUTER JOIN chats c2 ON pairs.chat_id = c2.chat_id
	INNER JOIN contacts AS matcher ON matcher.contact_id = pairs.matcher_contact_id 
	INNER JOIN contacts AS first ON first.contact_id = pairs.first_contact_id 
	INNER JOIN contacts AS second ON second.contact_id = pairs.second_contact_id 
	WHERE second.contact_id = 262 AND (
		(second_contact_status = 'NOTIFIED') OR
		(first_contact_status = 'ACCEPT' AND second_contact_status = 'ACCEPT')))) pending_matches
	LEFT JOIN LATERAL 
		(SELECT min(time_diff) < interval '0 seconds' has_unseen FROM 
			((SELECT pending_matches.matcher_seen_at - max(m1.created_at) time_diff FROM messages m1
				WHERE m1.chat_id = pending_matches.matcher_chat_id GROUP BY m1.chat_id)
			UNION 
			(SELECT pending_matches.main_seen_at - max(m2.created_at) time_diff FROM messages m2
				WHERE m2.chat_id = pending_matches.main_chat_id GROUP BY m2.chat_id)) s
			) p2 ON true
	ORDER BY has_unseen ASC, pending_matches.created_at DESC;
