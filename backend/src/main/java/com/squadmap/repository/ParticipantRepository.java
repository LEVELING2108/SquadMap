package com.squadmap.repository;

import com.squadmap.model.Participant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ParticipantRepository extends JpaRepository<Participant, String> {
    List<Participant> findBySessionId(String sessionId);
    Optional<Participant> findByIdAndSessionId(String id, String sessionId);
}
