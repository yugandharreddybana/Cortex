package com.cortex.api.repository;

import com.cortex.api.entity.Referral;
import com.cortex.api.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface ReferralRepository extends JpaRepository<Referral, Long> {
    Optional<Referral> findByReferred(User referred);
    List<Referral> findByReferrer(User referrer);
    long countByReferrerAndStatus(User referrer, String status);
    long countByReferrer(User referrer);
}
