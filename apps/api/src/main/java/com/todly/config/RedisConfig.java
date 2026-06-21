package com.todly.config;

import com.todly.realtime.RealtimeEventSubscriber;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * Redis pub/sub wiring for the realtime fanout.
 *
 * <p>Registered as an {@link AutoConfiguration} ordered AFTER
 * {@link RedisAutoConfiguration} and gated on a {@link RedisConnectionFactory}
 * bean. This ordering is what makes {@code @ConditionalOnBean} reliable — a
 * user {@code @Configuration} is processed before autoconfig, so the factory
 * would not yet exist and the condition would wrongly skip. As an
 * auto-configuration the condition is evaluated after Redis autoconfig has run.
 *
 * <p>Effect: the legacy PHASE 0-4 tests exclude {@code RedisAutoConfiguration}
 * (no factory) so this whole config quietly disappears — no Redis container
 * needed — while the production app and {@code RealtimeStompTest} get full
 * pub/sub fanout.
 *
 * <p><b>Single-path design</b>: domain code only ever publishes to the
 * {@code todly:events} channel; the {@link RedisMessageListenerContainer} below
 * is the ONLY component that calls {@code SimpMessagingTemplate}. This makes the
 * behaviour identical on 1 or N instances and structurally impossible to
 * double-send.
 */
@AutoConfiguration(after = RedisAutoConfiguration.class)
@ConditionalOnBean(RedisConnectionFactory.class)
public class RedisConfig {

    /** The Redis pub/sub channel carrying all realtime envelopes. */
    public static final String EVENTS_CHANNEL = "todly:events";

    @Bean
    public MessageListenerAdapter realtimeListenerAdapter(RealtimeEventSubscriber subscriber) {
        // Calls subscriber.onMessage(String body) for each published payload.
        // StringRedisSerializer ensures the raw JSON is handed over as a String
        // (the default JDK serializer would fail to deserialize a plain string).
        MessageListenerAdapter adapter = new MessageListenerAdapter(subscriber, "onMessage");
        adapter.setSerializer(new StringRedisSerializer());
        adapter.afterPropertiesSet();
        return adapter;
    }

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory factory,
            MessageListenerAdapter realtimeListenerAdapter) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        container.addMessageListener(realtimeListenerAdapter, new ChannelTopic(EVENTS_CHANNEL));
        return container;
    }
}
