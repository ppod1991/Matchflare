﻿SELECT * FROM 
	(SELECT c1.matcher_seen_at first_seen_at, c2.matcher_seen_at second_seen_at, pairs.created_at,
		pairs.chat_id, pair_id, matcher.guessed_full_name AS matcher_full_name, first.guessed_full_name AS first_full_name, second.guessed_full_name AS second_full_name, 
		matcher.image_url AS matcher_image, first.image_url AS first_image, second.image_url AS second_image, matcher.guessed_gender AS matcher_gender, 
		matcher.contact_id AS matcher_contact_id, first.contact_id AS first_contact_id, second.contact_id AS second_contact_id, 
		first_contact_status, second_contact_status, is_anonymous, first_matcher_chat_id, second_matcher_chat_id 
	FROM pairs
	LEFT OUTER JOIN chats c1 ON pairs.first_matcher_chat_id = c1.chat_id
	LEFT OUTER JOIN chats c2 ON pairs.second_matcher_chat_id = c2.chat_id
	INNER JOIN contacts AS matcher ON matcher.contact_id = pairs.matcher_contact_id 
	INNER JOIN contacts AS first ON first.contact_id = pairs.first_contact_id 
	INNER JOIN contacts AS second ON second.contact_id = pairs.second_contact_id 
	WHERE pairs.matcher_contact_id = 262
		AND ((pairs.first_contact_status = 'NOTIFIED' AND pairs.second_contact_status = 'ACCEPT') 
		OR (pairs.first_contact_status = 'ACCEPT' AND pairs.second_contact_status = 'NOTIFIED') 
		OR (pairs.first_contact_status = 'ACCEPT' AND pairs.second_contact_status = 'ACCEPT'))
	) pending_matches
LEFT JOIN LATERAL 
	(SELECT min(time_diff) < interval '0 seconds' has_unseen FROM 
		((SELECT pending_matches.first_seen_at - max(m1.created_at) time_diff FROM messages m1
			WHERE m1.chat_id = pending_matches.first_matcher_chat_id GROUP BY m1.chat_id)
		UNION 
		(SELECT pending_matches.second_seen_at - max(m2.created_at) time_diff FROM messages m2
			WHERE m2.chat_id = pending_matches.second_matcher_chat_id GROUP BY m2.chat_id)) s
		) p2 ON true
ORDER BY has_unseen ASC, pending_matches.created_at DESC;
