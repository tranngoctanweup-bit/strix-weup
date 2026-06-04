"""
Strix Pro - Scheduler Service
Manages scheduled security scans using APScheduler with SQLAlchemy jobstore.
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.triggers.cron import CronTrigger
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR

from sqlalchemy.orm import Session

from src.db.models import (
    SessionLocal, ScanSchedule, Scan, Target,
    ScanStatus, create_scan, update_scan_status
)
from src.core.tool_engine import ToolEngine

logger = logging.getLogger(__name__)

# Default database path for APScheduler jobstore
import os
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'strix.db')


class SchedulerService:
    """
    Manages scheduled security scans via APScheduler.

    Uses a SQLAlchemy jobstore so that job state survives application restarts.
    Each schedule entry mirrors a ScanSchedule row in the database.
    """

    def __init__(self, db_url: Optional[str] = None):
        if db_url is None:
            db_url = f"sqlite:///{DB_PATH}"

        jobstores = {
            "default": SQLAlchemyJobStore(url=db_url, tablename="apscheduler_jobs")
        }

        self.scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            job_defaults={
                "coalesce": True,
                "max_instances": 1,
                "misfire_grace_time": 300,
            },
        )
        self.tool_engine = ToolEngine()
        self._started = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self):
        """Start the scheduler."""
        if not self._started:
            self.scheduler.add_listener(self._on_job_executed, EVENT_JOB_EXECUTED)
            self.scheduler.add_listener(self._on_job_error, EVENT_JOB_ERROR)
            self.scheduler.start()
            self._started = True
            logger.info("Scheduler started")

    def shutdown(self, wait: bool = True):
        """Shutdown the scheduler."""
        if self._started:
            self.scheduler.shutdown(wait=wait)
            self._started = False
            logger.info("Scheduler shut down")

    # ------------------------------------------------------------------
    # Schedule CRUD
    # ------------------------------------------------------------------

    def schedule_scan(
        self,
        db: Session,
        target_id: int,
        name: str,
        scan_type: str,
        cron_expression: str,
        tool: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> ScanSchedule:
        """
        Create a new scheduled scan.

        Args:
            db: Database session.
            target_id: ID of the target to scan.
            name: Human-readable schedule name.
            scan_type: Type of scan (port_scan, subdomain, web_scan, vulnerability).
            cron_expression: Standard cron expression (5 fields).
            tool: Specific tool to use (auto-detected from scan_type if None).
            config: Extra configuration dict stored with the schedule.

        Returns:
            The created ScanSchedule record.
        """
        # Verify target exists
        target = db.query(Target).filter(Target.id == target_id).first()
        if not target:
            raise ValueError(f"Target {target_id} not found")

        # Parse cron expression into kwargs
        cron_parts = cron_expression.strip().split()
        if len(cron_parts) != 5:
            raise ValueError(
                "Cron expression must have 5 fields: minute hour day month day_of_week"
            )

        cron_kwargs = {
            "minute": cron_parts[0],
            "hour": cron_parts[1],
            "day": cron_parts[2],
            "month": cron_parts[3],
            "day_of_week": cron_parts[4],
        }

        # Persist schedule in DB
        schedule = ScanSchedule(
            target_id=target_id,
            name=name,
            scan_type=scan_type,
            tool=tool,
            cron_expression=cron_expression,
            is_active=True,
            next_run=None,  # will be set by APScheduler
            config=config or {},
        )
        db.add(schedule)
        db.commit()
        db.refresh(schedule)

        # Add job to APScheduler
        trigger = CronTrigger(**cron_kwargs)
        job_id = f"scan_schedule_{schedule.id}"
        self.scheduler.add_job(
            self.run_scheduled_scan,
            trigger=trigger,
            id=job_id,
            name=name,
            replace_existing=True,
            kwargs={"schedule_id": schedule.id},
        )

        # Update next_run from the scheduler's computed time
        job = self.scheduler.get_job(job_id)
        if job and job.next_run_time:
            schedule.next_run = job.next_run_time
            db.commit()

        logger.info(f"Schedule '{name}' (id={schedule.id}) created with cron '{cron_expression}'")
        return schedule

    def list_schedules(self, db: Session, active_only: bool = False) -> List[ScanSchedule]:
        """Return all schedules, optionally filtering to active only."""
        query = db.query(ScanSchedule)
        if active_only:
            query = query.filter(ScanSchedule.is_active == True)
        return query.order_by(ScanSchedule.created_at.desc()).all()

    def get_schedule(self, db: Session, schedule_id: int) -> Optional[ScanSchedule]:
        """Get a single schedule by ID."""
        return db.query(ScanSchedule).filter(ScanSchedule.id == schedule_id).first()

    def pause_schedule(self, db: Session, schedule_id: int) -> ScanSchedule:
        """Pause a running schedule."""
        schedule = db.query(ScanSchedule).filter(ScanSchedule.id == schedule_id).first()
        if not schedule:
            raise ValueError(f"Schedule {schedule_id} not found")

        job_id = f"scan_schedule_{schedule_id}"
        job = self.scheduler.get_job(job_id)
        if job:
            job.pause()

        schedule.is_active = False
        db.commit()
        logger.info(f"Schedule {schedule_id} paused")
        return schedule

    def resume_schedule(self, db: Session, schedule_id: int) -> ScanSchedule:
        """Resume a paused schedule."""
        schedule = db.query(ScanSchedule).filter(ScanSchedule.id == schedule_id).first()
        if not schedule:
            raise ValueError(f"Schedule {schedule_id} not found")

        job_id = f"scan_schedule_{schedule_id}"
        job = self.scheduler.get_job(job_id)
        if job:
            job.resume()
            if job.next_run_time:
                schedule.next_run = job.next_run_time

        schedule.is_active = True
        db.commit()
        logger.info(f"Schedule {schedule_id} resumed")
        return schedule

    def delete_schedule(self, db: Session, schedule_id: int) -> bool:
        """Remove a schedule entirely."""
        schedule = db.query(ScanSchedule).filter(ScanSchedule.id == schedule_id).first()
        if not schedule:
            raise ValueError(f"Schedule {schedule_id} not found")

        job_id = f"scan_schedule_{schedule_id}"
        job = self.scheduler.get_job(job_id)
        if job:
            job.remove()

        db.delete(schedule)
        db.commit()
        logger.info(f"Schedule {schedule_id} deleted")
        return True

    # ------------------------------------------------------------------
    # Scan execution (called by APScheduler)
    # ------------------------------------------------------------------

    async def run_scheduled_scan(self, schedule_id: int):
        """
        Execute a scheduled scan.

        Called automatically by APScheduler. Creates a new Scan record and
        delegates to ToolEngine for the actual security tool execution.
        """
        db = SessionLocal()
        try:
            schedule = db.query(ScanSchedule).filter(ScanSchedule.id == schedule_id).first()
            if not schedule:
                logger.error(f"Schedule {schedule_id} not found during execution")
                return

            if not schedule.is_active:
                logger.info(f"Schedule {schedule_id} is inactive, skipping")
                return

            target = db.query(Target).filter(Target.id == schedule.target_id).first()
            if not target:
                logger.error(f"Target {schedule.target_id} not found for schedule {schedule_id}")
                return

            # Create scan record
            scan = create_scan(
                db,
                target_id=schedule.target_id,
                scan_type=schedule.scan_type,
                tool=schedule.tool,
            )

            # Determine tool
            tool_name = schedule.tool or {
                "port_scan": "nmap",
                "subdomain": "subfinder",
                "web_scan": "nikto",
                "vulnerability": "nuclei",
            }.get(schedule.scan_type, "nmap")

            # Execute via ToolEngine
            try:
                update_scan_status(db, scan.id, ScanStatus.RUNNING.value)

                args = {
                    "target": target.host,
                    "domain": target.host,
                    "url": f"http://{target.host}",
                }
                args.update(schedule.config.get("extra_args", {}))

                result = self.tool_engine.execute(tool_name, args, auto_save=True)

                if result.success:
                    update_scan_status(
                        db,
                        scan.id,
                        ScanStatus.COMPLETED.value,
                        output=result.output,
                    )
                    logger.info(
                        f"Scheduled scan {scan.id} completed for schedule {schedule_id}"
                    )
                else:
                    update_scan_status(
                        db,
                        scan.id,
                        ScanStatus.FAILED.value,
                        error=result.error,
                    )
                    logger.error(
                        f"Scheduled scan {scan.id} failed: {result.error}"
                    )

            except Exception as exc:
                update_scan_status(db, scan.id, ScanStatus.FAILED.value, error=str(exc))
                logger.exception(f"Scheduled scan {scan.id} raised an exception")

            # Update schedule metadata
            schedule.last_run = datetime.utcnow()
            job_id = f"scan_schedule_{schedule_id}"
            job = self.scheduler.get_job(job_id)
            if job and job.next_run_time:
                schedule.next_run = job.next_run_time
            db.commit()

        finally:
            db.close()

    # ------------------------------------------------------------------
    # Event listeners
    # ------------------------------------------------------------------

    @staticmethod
    def _on_job_executed(event):
        logger.debug(f"Job {event.job_id} executed successfully")

    @staticmethod
    def _on_job_error(event):
        logger.error(
            f"Job {event.job_id} raised an exception: {event.exception}"
        )


# Module-level singleton
scheduler_service = SchedulerService()
